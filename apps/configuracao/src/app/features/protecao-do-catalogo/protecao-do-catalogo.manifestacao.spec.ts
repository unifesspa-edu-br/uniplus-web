import { TestBed } from '@angular/core/testing';
import { buildVendorMimeAccept } from '@uniplus/shared-core/http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PARECERES } from './manifestacoes';
import {
  CONSULTAR,
  MANIFESTAR,
  SEM_CONTEUDO,
  URL_DA_FILA,
  abrirItem,
  botaoDoRodape,
  clicar,
  detalheDoLaudo,
  digitar,
  laudo,
  manifestacao,
  montarPagina,
  problema,
  type PaginaMontada,
} from './protecao-do-catalogo.testing';

const URL_DA_MANIFESTACAO = `${URL_DA_FILA}/manifestacoes`;
const URL_DO_DETALHE = `${URL_DA_FILA}/tipos-documento/${laudo.id}`;
const URL_DO_HISTORICO = `${URL_DO_DETALHE}/manifestacoes`;
const RAIZ = 'uniplus.configuracao.protecao_do_catalogo.';

describe('ProtecaoDoCatalogoPage — manifestação técnica do Encarregado de dados', () => {
  let pagina: PaginaMontada;

  beforeEach(async () => {
    pagina = montarPagina([MANIFESTAR, CONSULTAR]);
    await pagina.carregarFila([laudo]);
    await abrirItem(pagina, laudo, detalheDoLaudo);
  });

  afterEach(() => pagina.encerrar());

  const formulario = () =>
    pagina.tela.querySelector('cfg-manifestacao-do-item form') as HTMLFormElement;
  const parecer = (valor: string) => {
    const rotulo = PARECERES.find((p) => p.valor === valor)?.rotulo;
    const opcao = [...formulario().querySelectorAll('label.radio')].find(
      (label) => label.textContent?.trim() === rotulo,
    );
    return opcao?.querySelector<HTMLInputElement>('input[type="radio"]');
  };
  const texto = () => formulario().querySelector('textarea') as HTMLTextAreaElement;
  const manifestacoes = () =>
    pagina.controller.match((r) => r.method === 'POST' && r.url === URL_DA_MANIFESTACAO);

  async function enviar(): Promise<void> {
    formulario().dispatchEvent(new Event('submit'));
    await pagina.assentar();
  }

  async function escolher(valor: string, comTexto?: string): Promise<void> {
    clicar(parecer(valor), `o parecer ${valor}`);
    if (comTexto !== undefined) digitar(texto(), comTexto);
    await pagina.assentar();
  }

  /** Termina a gravação: as respostas são promessas, então espera o desfecho chegar à tela. */
  async function responder(
    resposta: Readonly<Parameters<ReturnType<typeof manifestacoes>[number]['flush']>>,
  ): Promise<void> {
    manifestacoes()[0]?.flush(...resposta);
    await new Promise((resolver) => setTimeout(resolver));
    await pagina.assentar();
  }

  it('o Encarregado de dados vê o formulário e o histórico, mas não as ações de decidir', () => {
    expect(formulario()).not.toBeNull();
    for (const acao of ['Aprovar', 'Reprovar', 'Recomendar ajuste']) {
      expect(botaoDoRodape(pagina.tela, acao), acao).toBeUndefined();
    }
    const historico = pagina.controller.expectOne(URL_DO_HISTORICO);
    expect(historico.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('protecao-do-catalogo-manifestacao', 1),
    );
    historico.flush([]);
  });

  it('o parecer adequado vai sem texto, no ciclo lido, com Idempotency-Key, e relê o item e o histórico', async () => {
    await escolher('ADEQUADA');
    await enviar();

    const [envio] = manifestacoes();
    expect(envio?.request.body).toEqual({
      cadastro: 'TIPO_DOCUMENTO',
      itemId: laudo.id,
      ciclo: 2,
      parecer: 'ADEQUADA',
      texto: null,
    });
    expect(envio?.request.headers.get('Idempotency-Key')).toBeTruthy();
    envio?.flush(null, SEM_CONTEUDO);
    await new Promise((resolver) => setTimeout(resolver));
    await pagina.assentar();

    expect(parecer('ADEQUADA')?.checked, 'o formulário volta ao início').toBe(false);
    pagina.controller.expectOne(URL_DO_DETALHE).flush(detalheDoLaudo);
    expect(pagina.controller.match(URL_DO_HISTORICO).length).toBeGreaterThan(0);
  });

  it('o parecer desfavorável sem texto não é enviado e o erro fica no campo', async () => {
    await escolher('INADEQUADA');
    await enviar();

    expect(manifestacoes()).toHaveLength(0);
    expect(texto().getAttribute('aria-invalid')).toBe('true');
    expect(pagina.tela.textContent).toContain(
      'Os pareceres recomenda ajuste e inadequada exigem o texto.',
    );
  });

  it('a recusa por campo (422) fica no campo do texto', async () => {
    await escolher('RECOMENDA_AJUSTE', 'Recomendo sensível.');
    await enviar();

    const recusa = {
      status: 422,
      code: `${RAIZ}texto_da_manifestacao_muito_longo`,
      title: 'x',
      errors: [
        {
          field: 'texto',
          code: `${RAIZ}texto_da_manifestacao_muito_longo`,
          message: 'O texto passa de 2.000 caracteres.',
        },
      ],
    };
    await responder([JSON.stringify(recusa), problema(422, recusa.code, 'x')[1]]);

    expect(texto().getAttribute('aria-invalid')).toBe('true');
    expect(pagina.tela.textContent).toContain('O texto passa de 2.000 caracteres.');
  });

  it.each(['ciclo_mudou', 'decisao_ja_tomada'])(
    'com o 409 %s, avisa, relê o item e não reenvia sozinho',
    async (codigo) => {
      await escolher('ADEQUADA');
      await enviar();
      await responder(problema(409, `${RAIZ}${codigo}`, 'O item mudou'));

      expect(pagina.tela.textContent).toContain('O item foi relido');
      pagina.controller.expectOne(URL_DO_DETALHE).flush(detalheDoLaudo);
      expect(manifestacoes()).toHaveLength(0);
    },
  );

  it('conta o texto em caracteres: 2.000 fora do plano básico cabem e são enviados', async () => {
    await escolher('INADEQUADA', '😀'.repeat(2000));

    expect(formulario().textContent).toContain('2000 de 2.000');
    await enviar();
    const [envio] = manifestacoes();
    expect(envio?.request.body).toMatchObject({ texto: '😀'.repeat(2000) });
    envio?.flush(null, SEM_CONTEUDO);
    await new Promise((resolver) => setTimeout(resolver));
    await pagina.assentar();
    pagina.controller.expectOne(URL_DO_DETALHE).flush(detalheDoLaudo);
  });

  it('acima de 2.000 caracteres o texto não é enviado', async () => {
    await escolher('INADEQUADA', '😀'.repeat(2001));
    await enviar();

    expect(manifestacoes()).toHaveLength(0);
    expect(texto().getAttribute('aria-invalid')).toBe('true');
  });

  it('o conflito retentável (409) se repete uma vez, com a mesma chave', async () => {
    await escolher('ADEQUADA');
    await enviar();
    const [primeira] = manifestacoes();
    const chave = primeira?.request.headers.get('Idempotency-Key');
    primeira?.flush(
      JSON.stringify({
        status: 409,
        code: `${RAIZ}conflito_de_concorrencia`,
        title: 'x',
        retryable: true,
      }),
      problema(409, `${RAIZ}conflito_de_concorrencia`, 'x')[1],
    );
    await pagina.assentar();

    const [segunda] = manifestacoes();
    expect(segunda?.request.headers.get('Idempotency-Key')).toBe(chave);
    segunda?.flush(null, SEM_CONTEUDO);
    await new Promise((resolver) => setTimeout(resolver));
    await pagina.assentar();
    pagina.controller.expectOne(URL_DO_DETALHE).flush(detalheDoLaudo);
  });

  it('mostra as manifestações vigentes do ciclo no detalhe', async () => {
    pagina.encerrar();
    TestBed.resetTestingModule();
    pagina = montarPagina([MANIFESTAR]);
    await pagina.carregarFila([laudo]);
    await abrirItem(pagina, laudo, { ...detalheDoLaudo, manifestacoesVigentes: [manifestacao()] });

    const vigentes = pagina.tela.querySelector('[aria-label="Manifestações vigentes no ciclo"]');
    expect(vigentes?.textContent).toContain('Inadequada');
    expect(vigentes?.textContent).toContain('Isabella Figueiredo');
    expect(vigentes?.textContent).toContain('ciclo 2');
  });
});
