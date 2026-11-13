import { TestBed } from '@angular/core/testing';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EdicaoDaProtecaoDoCatalogo } from './edicao-da-protecao-do-catalogo';
import {
  CODIGO_DE_PROCESSAMENTO,
  CODIGO_PROTECAO_MUDOU,
  SEM_CONTEUDO,
  URL_DA_FILA,
  botaoPorTexto,
  clicar,
  laudo,
  montarPagina,
  problema,
  type PaginaMontada,
} from './protecao-do-catalogo.testing';

const APROVAR = 'configuracao:protecao-do-catalogo:aprovar';
const ERRO_INTERNO = problema(500, 'uniplus.internal.unexpected', 'Erro interno');

describe('ProtecaoDoCatalogoPage — decisão, recusas e foco', () => {
  let pagina: PaginaMontada;
  let avisoDeErro: MockInstance<NotificationService['errorFromProblem']>;
  let avisoDeSucesso: MockInstance<NotificationService['success']>;

  beforeEach(async () => {
    pagina = montarPagina([APROVAR]);
    const avisos = TestBed.inject(NotificationService);
    avisoDeErro = vi.spyOn(avisos, 'errorFromProblem');
    avisoDeSucesso = vi.spyOn(avisos, 'success');
    await pagina.carregarFila([laudo]);
  });

  afterEach(() => pagina.encerrar());

  const drawer = (): HTMLDialogElement =>
    pagina.tela.querySelector('dialog[aria-label^="Detalhe do item"]') as HTMLDialogElement;
  const dialogoDaDecisao = (): HTMLElement => pagina.tela.querySelector('ui-dialog') as HTMLElement;
  const postagens = () =>
    pagina.controller.match((r) => r.method === 'POST' && r.url === URL_DA_FILA);
  const umaPostagem = () =>
    pagina.controller.expectOne((r) => r.method === 'POST' && r.url === URL_DA_FILA);
  const leituraDaFila = () =>
    pagina.controller.expectOne((r) => r.method === 'GET' && r.url === URL_DA_FILA);
  const tituloDaFila = (): HTMLElement =>
    pagina.tela.querySelector('#cfg-protecao-titulo') as HTMLElement;

  async function abrirComAprovacaoPendente() {
    await pagina.abrirDetalhe();
    const aprovar = botaoPorTexto(drawer(), 'Aprovar');
    aprovar.focus();
    clicar(aprovar);
    await pagina.assentar();
    return { aprovar, envio: umaPostagem() };
  }

  async function reprovarComJustificativa(): Promise<HTMLButtonElement> {
    await pagina.abrirDetalhe();
    clicar(botaoPorTexto(drawer(), 'Reprovar'));
    await pagina.assentar();
    const campo = dialogoDaDecisao().querySelector('textarea') as HTMLTextAreaElement;
    campo.value = 'Falta a base legal.';
    campo.dispatchEvent(new Event('input'));
    await pagina.assentar();
    const confirmar = botaoPorTexto(dialogoDaDecisao(), 'Reprovar item');
    confirmar.focus();
    clicar(confirmar);
    await pagina.assentar();
    return confirmar;
  }

  it('aprovar pendente ocupa o botão sem tirar-lhe o foco, recusa Fechar e Esc e não reenvia', async () => {
    const { aprovar, envio } = await abrirComAprovacaoPendente();

    expect(aprovar.matches(':disabled')).toBe(false);
    expect(aprovar.getAttribute('aria-disabled')).toBe('true');
    expect(aprovar.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(aprovar);
    expect(drawer().querySelector('[role="status"]')?.textContent?.trim()).toBe(
      'Registrando a decisão.',
    );
    expect(drawer().querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled).toBe(
      true,
    );
    expect(botaoPorTexto(drawer(), 'Fechar').disabled).toBe(true);
    drawer().dispatchEvent(new Event('cancel', { cancelable: true }));
    clicar(aprovar);
    await pagina.assentar();
    expect(drawer().hasAttribute('open')).toBe(true);
    expect(postagens()).toHaveLength(0);

    envio.flush(null, SEM_CONTEUDO);
    await pagina.assentar();
    leituraDaFila().flush([]);
    await pagina.assentar();
    expect(drawer().hasAttribute('open')).toBe(false);
  });

  it('aprovar com erro do servidor avisa, devolve o botão com o foco e a nova tentativa usa a mesma chave', async () => {
    const { aprovar, envio } = await abrirComAprovacaoPendente();
    const chave = envio.request.headers.get('Idempotency-Key');

    envio.flush(...ERRO_INTERNO);
    await pagina.assentar();

    expect(avisoDeErro).toHaveBeenCalledTimes(1);
    expect(avisoDeSucesso).not.toHaveBeenCalled();
    expect(aprovar.getAttribute('aria-disabled')).toBeNull();
    expect(document.activeElement).toBe(aprovar);
    expect(drawer().textContent).toContain('Erro interno');

    clicar(aprovar);
    await pagina.assentar();
    const segunda = umaPostagem();
    expect(segunda.request.headers.get('Idempotency-Key')).toBe(chave);
    segunda.flush(null, SEM_CONTEUDO);
    await pagina.assentar();
    leituraDaFila().flush([]);
    await pagina.assentar();

    expect(avisoDeSucesso).toHaveBeenCalledWith('Item aprovado', laudo.nome);
    expect(document.activeElement).toBe(tituloDaFila());
  });

  async function abrirItemComLeituraRecusada(status: number): Promise<void> {
    clicar(
      pagina.tela.querySelector(`td button[aria-label="Ver o detalhe de ${laudo.nome}"]`),
      'a linha',
    );
    await pagina.assentar();
    pagina.controller
      .expectOne(`${URL_DA_FILA}/tipos-documento/${laudo.id}`)
      .flush(...problema(status, 'uniplus.recusa', 'Recusa'));
    await pagina.assentar();
  }

  it('erro do servidor na leitura do detalhe avisa uma vez', async () => {
    await abrirItemComLeituraRecusada(500);

    expect(avisoDeErro).toHaveBeenCalledTimes(1);
  });

  it.each([403, 404])('recusa %i na leitura do detalhe não vira aviso', async (status) => {
    await abrirItemComLeituraRecusada(status);

    expect(avisoDeErro).not.toHaveBeenCalled();
  });

  it('recusa 4xx da decisão não vira aviso de erro e fica no drawer', async () => {
    const { envio } = await abrirComAprovacaoPendente();

    envio.flush(
      ...problema(
        422,
        'uniplus.configuracao.protecao_do_catalogo.sem_quem_aprove',
        'Sem quem aprove',
      ),
    );
    await pagina.assentar();

    expect(avisoDeErro).not.toHaveBeenCalled();
    expect(drawer().textContent).toContain('Sem quem aprove');
    expect(drawer().hasAttribute('open')).toBe(true);
  });

  it('proteção alterada por outra pessoa fecha o drawer, relê a fila e a próxima decisão ganha chave nova', async () => {
    const { envio } = await abrirComAprovacaoPendente();
    const chave = envio.request.headers.get('Idempotency-Key');

    envio.flush(...problema(409, CODIGO_PROTECAO_MUDOU, 'A proteção do item mudou'));
    await pagina.assentar();
    leituraDaFila().flush([laudo]);
    await pagina.assentar();

    expect(avisoDeErro).not.toHaveBeenCalled();
    expect(drawer().hasAttribute('open')).toBe(false);
    expect(pagina.tela.textContent).toContain('A proteção do item mudou');

    await pagina.abrirDetalhe();
    clicar(botaoPorTexto(drawer(), 'Aprovar'));
    await pagina.assentar();
    const nova = umaPostagem();
    expect(nova.request.headers.get('Idempotency-Key')).not.toBe(chave);
    nova.flush(null, SEM_CONTEUDO);
    await pagina.assentar();
    leituraDaFila().flush([]);
  });

  it.each([
    [422, 'uniplus.configuracao.protecao_do_catalogo.item_fora_de_solicitacao'],
    [409, 'uniplus.configuracao.protecao_do_catalogo.conflito_de_concorrencia'],
    [409, 'uniplus.configuracao.protecao_do_catalogo.protecao_mudou'],
    [404, 'uniplus.configuracao.tipo_documento.nao_encontrado'],
    [404, 'uniplus.configuracao.fato_candidato.nao_encontrado'],
  ])('recusa %i %s relê a fila e não oferece mais a decisão', async (status, codigo) => {
    const { envio } = await abrirComAprovacaoPendente();

    envio.flush(...problema(status, codigo, 'O item mudou'));
    await pagina.assentar();
    leituraDaFila().flush([]);
    await pagina.assentar();

    expect(avisoDeErro).not.toHaveBeenCalled();
    expect(drawer().hasAttribute('open')).toBe(false);
    expect(pagina.tela.textContent).toContain('Nenhum item aguardando a sua decisão');
    expect(pagina.tela.textContent).toContain('O item mudou');
  });

  it('reprovar com sucesso avisa "Item reprovado"', async () => {
    await reprovarComJustificativa();

    umaPostagem().flush(null, SEM_CONTEUDO);
    await pagina.assentar();
    leituraDaFila().flush([]);
    await pagina.assentar();

    expect(avisoDeSucesso).toHaveBeenCalledExactlyOnceWith('Item reprovado', laudo.nome);
  });

  it('recomendar ajuste com sucesso avisa "Ajuste recomendado"', async () => {
    await pagina.abrirDetalhe();
    clicar(botaoPorTexto(drawer(), 'Recomendar ajuste'));
    await pagina.assentar();
    const edicao = pagina.fixture.debugElement.injector.get(EdicaoDaProtecaoDoCatalogo);
    edicao.recomendada.setValue(edicao.opcoesDaRecomendacao()[0].valor);
    clicar(botaoPorTexto(dialogoDaDecisao(), 'Recomendar ajuste'));
    await pagina.assentar();

    umaPostagem().flush(null, SEM_CONTEUDO);
    await pagina.assentar();
    leituraDaFila().flush([]);
    await pagina.assentar();

    expect(avisoDeSucesso).toHaveBeenCalledExactlyOnceWith('Ajuste recomendado', laudo.nome);
  });

  it('decisão ainda em processamento mantém o drawer, não relê a fila e repete com a mesma chave', async () => {
    const { aprovar, envio } = await abrirComAprovacaoPendente();
    const chave = envio.request.headers.get('Idempotency-Key');

    envio.flush(...problema(409, CODIGO_DE_PROCESSAMENTO, 'A decisão ainda está em processamento'));
    await pagina.assentar();

    expect(avisoDeErro).not.toHaveBeenCalled();
    expect(drawer().hasAttribute('open')).toBe(true);
    expect(drawer().textContent).toContain('A decisão ainda está em processamento');
    pagina.controller.expectNone((r) => r.method === 'GET' && r.url === URL_DA_FILA);

    clicar(aprovar);
    await pagina.assentar();
    const repetida = umaPostagem();
    expect(repetida.request.headers.get('Idempotency-Key')).toBe(chave);
    repetida.flush(null, SEM_CONTEUDO);
    await pagina.assentar();
    leituraDaFila().flush([]);
  });

  it('reprovar ainda em processamento mantém o diálogo com a mensagem e a mesma chave', async () => {
    const confirmar = await reprovarComJustificativa();
    const primeira = umaPostagem();
    const chave = primeira.request.headers.get('Idempotency-Key');

    primeira.flush(
      ...problema(409, CODIGO_DE_PROCESSAMENTO, 'A decisão ainda está em processamento'),
    );
    await pagina.assentar();

    expect(dialogoDaDecisao().querySelector('dialog')?.hasAttribute('open')).toBe(true);
    expect(dialogoDaDecisao().textContent).toContain('A decisão ainda está em processamento');
    expect(confirmar.getAttribute('aria-disabled')).toBe('false');
    expect(document.activeElement).toBe(confirmar);
    pagina.controller.expectNone((r) => r.method === 'GET' && r.url === URL_DA_FILA);

    clicar(confirmar);
    await pagina.assentar();
    const segunda = umaPostagem();
    expect(segunda.request.headers.get('Idempotency-Key')).toBe(chave);
    segunda.flush(null, SEM_CONTEUDO);
    await pagina.assentar();
    leituraDaFila().flush([]);
  });

  it('diálogo que se fecha sozinho pela proteção alterada deixa o foco no título da fila', async () => {
    await reprovarComJustificativa();

    umaPostagem().flush(...problema(409, CODIGO_PROTECAO_MUDOU, 'A proteção do item mudou'));
    await pagina.assentar();
    leituraDaFila().flush([]);
    await pagina.assentar();

    expect(dialogoDaDecisao().querySelector('dialog')?.hasAttribute('open')).toBe(false);
    expect(document.activeElement).toBe(tituloDaFila());
  });

  it('o seletor da classificação recomendada é obrigatório para quem usa leitor de tela', async () => {
    await pagina.abrirDetalhe();
    clicar(botaoPorTexto(drawer(), 'Recomendar ajuste'));
    await pagina.assentar();

    expect(dialogoDaDecisao().querySelector('select')?.getAttribute('aria-required')).toBe('true');
  });
});
