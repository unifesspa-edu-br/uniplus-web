import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FatosCandidatoPage } from './fatos-candidato.page';

const BASE = 'http://localhost:5000';
const LISTA = `${BASE}/api/configuracao/admin/fatos-candidato`;
const FASES = `${BASE}/api/configuracao/fases-canonicas`;
const CATALOGO = `${BASE}/api/configuracao/fatos-candidato`;
const PROTECAO = `${BASE}/api/configuracao/admin/protecao-do-catalogo`;
const PROBLEMA = (status: number) => ({ status, statusText: 'Recusa', headers: { 'content-type': 'application/problem+json' } });

const concedidas = signal<readonly string[]>(['configuracao:fatos-candidato:manter']);

describe('FatosCandidatoPage', () => {
  let fixture: ComponentFixture<FatosCandidatoPage>;
  let component: FatosCandidatoPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    concedidas.set(['configuracao:fatos-candidato:manter']);
    TestBed.configureTestingModule({
      imports: [FatosCandidatoPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        {
          provide: PermissoesService,
          useValue: { tem: (codigo: string) => concedidas().includes(codigo) },
        },
      ],
    });
    fixture = TestBed.createComponent(FatosCandidatoPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  /** Atende a lista do que aguarda a proteção de dados; os testes que não a inspecionam a deixam vazia. */
  function atenderPendencias(itens: readonly unknown[] = []): void {
    for (const req of controller.match((r) => r.url === PROTECAO).filter((pedido) => !pedido.cancelled)) req.flush(itens);
  }

  afterEach(() => {
    atenderPendencias();
    controller.verify();
  });

  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
  };

  function atenderFases(): void {
    for (const req of controller.match((r) => r.url === FASES)) {
      req.flush([{ id: 'f1', codigo: 'INSCRICAO', nome: 'Inscrição', descricao: null }]);
    }
  }

  it('CA-01: a situação e a origem escolhidas chegam à consulta da API', async () => {
    atenderFases();
    const primeira = controller.expectOne((r) => r.url === LISTA);
    expect(primeira.request.params.get('ativo')).toBe('true');
    expect(primeira.request.params.has('origem')).toBe(false);
    primeira.flush([]);
    await propagar();

    component['filtroOrigem'].set('DERIVADO');
    component['filtroSituacao'].set('');
    fixture.detectChanges();
    await propagar();

    const filtrada = controller.expectOne((r) => r.url === LISTA);
    expect(filtrada.request.params.get('origem')).toBe('DERIVADO');
    expect(filtrada.request.params.has('ativo')).toBe(false);
    filtrada.flush([]);
  });

  it('sem a permissão de manter, não oferece criar nem editar, e deixa visualizar', async () => {
    concedidas.set(['configuracao:fatos-candidato:consultar']);
    atenderFases();
    controller.expectOne((r) => r.url === LISTA).flush([
      {
        id: 'f1', codigo: 'RENDA', nome: 'Renda', origem: 'DECLARADO', dominio: 'NUMERO', sistema: false, ativo: true,
        classificacaoProtecao: 'PESSOAL',
        aprovacao: { situacao: 'NEGADA', solicitadaEm: null, decididaEm: null, classificacaoRecomendada: 'SENSIVEL', aceitaEm: null },
      },
    ]);
    await propagar();
    fixture.detectChanges();
    await propagar();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const botoes = Array.from(host.querySelectorAll('button')).map((b) => b.textContent ?? '');
    expect(botoes.some((texto) => texto.includes('Novo fato'))).toBe(false);
    const botoesDaLinha = Array.from(host.querySelectorAll('td button')).map((b) => b.textContent ?? '');
    expect(botoesDaLinha.some((texto) => texto.includes('Aceitar recomendação'))).toBe(false);
    const rotulos = Array.from(host.querySelectorAll('td.table-responsive__actions button')).map(
      (b) => b.getAttribute('aria-label') ?? '',
    );
    expect(rotulos).toEqual(['Visualizar o fato RENDA']);
  });

  it('as três opções de "O que o fato é" formam um grupo de rádio nativo', async () => {
    atenderFases();
    controller.expectOne((r) => r.url === LISTA).flush([]);
    await propagar();

    component['abrirCriacao']();
    fixture.detectChanges();

    const radios = Array.from(
      (fixture.nativeElement as HTMLElement).ownerDocument.querySelectorAll('input[type="radio"][formcontrolname="tipo"]'),
    ) as HTMLInputElement[];
    expect(radios.map((radio) => radio.value)).toEqual(['DECLARADO', 'DERIVADO', 'AGREGADO']);
    expect(radios.map((radio) => radio.name)).toEqual(['tipo', 'tipo', 'tipo']);
  });

  it('sem a lista de fases, a criação avisa e oferece tentar de novo em vez de um campo vazio', async () => {
    for (const req of controller.match((r) => r.url === FASES)) {
      req.flush(JSON.stringify({ status: 503, title: 'Indisponível', code: 'uniplus.indisponivel' }), PROBLEMA(503));
    }
    controller.expectOne((r) => r.url === LISTA).flush([]);
    await propagar();

    component['abrirCriacao']();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).ownerDocument.body.textContent).toContain('Fases não carregadas');
  });

  it('a falha na primeira página do filtro novo não deixa no paginador o cursor do filtro anterior', async () => {
    atenderFases();
    controller.expectOne((r) => r.url === LISTA).flush([], { headers: { Link: `<${LISTA}?cursor=pagina-2&direction=next>; rel="next"` } });
    await propagar();
    expect(component['nextCursor']()).not.toBeNull();

    component['filtroOrigem'].set('DERIVADO');
    fixture.detectChanges();
    await propagar();
    controller
      .expectOne((r) => r.url === LISTA)
      .flush(JSON.stringify({ status: 503, title: 'Indisponível', code: 'uniplus.indisponivel' }), PROBLEMA(503));
    await propagar();

    expect(component['nextCursor']()).toBeNull();
  });

  it('trocar o filtro volta à primeira página, e a escolha que saiu das opções se esvazia', async () => {
    atenderFases();
    controller.expectOne((r) => r.url === LISTA).flush([]);
    await propagar();
    component['pagina'].set({ cursor: { afterId: 'x' } as never, direction: 'next' });
    fixture.detectChanges();
    await propagar();
    controller.expectOne((r) => r.url === LISTA && r.params.has('cursor')).flush([]);
    await propagar();

    component['filtroOrigem'].set('DECLARADO');
    fixture.detectChanges();
    await propagar();
    const filtrada = controller.expectOne((r) => r.url === LISTA);
    expect(filtrada.request.params.has('cursor'), 'o cursor era do filtro anterior').toBe(false);
    filtrada.flush([]);

    component['form'].patchValue({ tipo: 'DECLARADO', dominio: 'TEXTO' });
    fixture.detectChanges();
    component['form'].patchValue({ tipo: 'DERIVADO' });
    fixture.detectChanges();
    expect(component['form'].controls.dominio.value, 'o derivado não é texto').toBe('');
  });

  it('a recusa da API chega ao campo: a de validação no campo dela, o código repetido no código', async () => {
    atenderFases();
    controller.expectOne((r) => r.url === LISTA).flush([]);
    await propagar();
    component['abrirCriacao']();
    fixture.detectChanges();
    component['form'].patchValue({
      tipo: 'DERIVADO',
      nome: 'Perfil socioeconômico',
      codigo: 'PERFIL',
      dominio: 'BOOLEANO',
      pontoResolucao: 'INSCRICAO',
      classificacaoProtecao: 'PESSOAL',
      finalidadeTratamento: 'Classificar a reserva de vagas.',
      hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
    });

    component['criar']();
    const derivado = controller.expectOne(`${LISTA}/derivados`);
    expect(derivado.request.body).not.toHaveProperty('cardinalidade');
    derivado.flush(
      JSON.stringify({
        status: 422,
        code: 'uniplus.validation_failed',
        title: 'Requisição inválida',
        errors: [{ field: 'PontoResolucao', code: 'uniplus.configuracao.fato_candidato.ponto_resolucao_invalido', message: 'Fase fora do catálogo.' }],
      }),
      PROBLEMA(422),
    );
    await propagar();
    expect(component['erro']('pontoResolucao')).toBe('Fase fora do catálogo.');
    const chaveDaPrimeira = derivado.request.headers.get('Idempotency-Key');

    component['form'].controls.pontoResolucao.setValue('INSCRICAO');
    component['criar']();
    const repetido = controller.expectOne(`${LISTA}/derivados`);
    expect(repetido.request.headers.get('Idempotency-Key'), 'depois de uma recusa, o próximo envio é outro comando').not.toBe(chaveDaPrimeira);
    repetido.flush(
      JSON.stringify({ status: 409, code: 'uniplus.configuracao.fato_candidato.codigo_ja_existe', title: 'O código já existe.' }),
      PROBLEMA(409),
    );
    await propagar();
    expect(component['erro']('codigo')).not.toBeNull();
  });

  const fatoDoAdministrador = {
    id: '01960000-0000-7000-0000-0000000000a1',
    codigo: 'TRABALHA',
    nome: 'Trabalha',
    descricao: '',
    componenteExibicao: null,
    dominio: 'BOOLEANO',
    origem: 'DECLARADO',
    cardinalidade: 'ESCALAR',
    fonteValores: null,
    formato: null,
    pontoResolucao: 'INSCRICAO',
    binding: 'CAMPO_INSCRICAO:TRABALHA',
    escopo: 'CANDIDATO',
    classificacaoProtecao: 'PESSOAL',
    finalidadeTratamento: 'Classificar a reserva de vagas.',
    hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
    sistema: false,
    ativo: true,
    valores: [],
    regrasPadrao: [],
    aprovacao: { situacao: 'APROVADA', solicitadaEm: null, decididaEm: null, classificacaoRecomendada: null, aceitaEm: null },
  };

  it('CA-01: o agregado vai à API com o fato de membro, sem tipo de dado nem escopo, e a recusa do membro chega ao campo', async () => {
    atenderFases();
    controller.expectOne((r) => r.url === LISTA).flush([]);
    await propagar();
    component['abrirCriacao']();
    fixture.detectChanges();
    await propagar();
    expect(controller.match(CATALOGO), 'o catálogo só é pedido para o agregado').toHaveLength(0);

    component['form'].patchValue({ tipo: 'AGREGADO' });
    fixture.detectChanges();
    await propagar();
    controller.expectOne(CATALOGO).flush([
      { id: 'm', codigo: 'MEMBRO_TRABALHA', nome: 'Membro trabalha', descricao: null, dominio: 'BOOLEANO', origem: 'DECLARADO',
        cardinalidade: 'ESCALAR', valoresDominio: null, pontoResolucao: 'INSCRICAO', binding: 'CAMPO_FORMULARIO:MEMBRO_TRABALHA',
        valoresDominioDeclarados: null, fonteValores: null, ativo: true, escopo: 'MEMBRO_GRUPO' },
    ]);
    await propagar();
    component['form'].patchValue({
      nome: 'Família com quem trabalha',
      codigo: 'FAMILIA_TRABALHA',
      fatoDeMembro: 'MEMBRO_TRABALHA',
      pontoResolucao: 'INSCRICAO',
      classificacaoProtecao: 'PESSOAL',
      finalidadeTratamento: 'Avaliar a renda familiar.',
      hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
    });

    component['criar']();
    const agregado = controller.expectOne(`${LISTA}/agregados`);
    expect(agregado.request.body).toEqual({
      codigo: 'FAMILIA_TRABALHA',
      nome: 'Família com quem trabalha',
      descricao: null,
      fatoDeMembro: 'MEMBRO_TRABALHA',
      pontoResolucao: 'INSCRICAO',
      classificacaoProtecao: 'PESSOAL',
      finalidadeTratamento: 'Avaliar a renda familiar.',
      hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
    });
    expect(agregado.request.headers.has('Idempotency-Key')).toBe(true);
    agregado.flush(
      JSON.stringify({
        status: 422,
        code: 'uniplus.validation_failed',
        title: 'Requisição inválida',
        errors: [{ field: 'fatoDeMembro', code: 'uniplus.vinculo_catalogo.fato_desativado', message: 'O fato está desativado.' }],
      }),
      PROBLEMA(422),
    );
    await propagar();
    expect(component['erro']('fatoDeMembro')).toBe('O fato está desativado.');
  });

  it('CA-02: o fato de sistema mostra o desativar desabilitado, com o porquê, e não oferece reativar', async () => {
    atenderFases();
    controller.expectOne((r) => r.url === LISTA).flush([{ ...fatoDoAdministrador, sistema: true }]);
    await propagar();
    fixture.detectChanges();
    const tela = fixture.nativeElement as HTMLElement;
    const desativar = tela.querySelector('[aria-label^="Desativar"]') as HTMLButtonElement;
    expect(desativar.disabled).toBe(true);
    expect(tela.querySelector(`#${desativar.getAttribute('aria-describedby')}`)?.textContent).toContain('Fato de sistema');
    expect(tela.querySelector('[aria-label^="Reativar"]')).toBeNull();
  });

  it('visualizar abre o fato só para consultar; editar, para alterar', async () => {
    atenderFases();
    controller.expectOne((r) => r.url === LISTA).flush([fatoDoAdministrador]);
    await propagar();
    fixture.detectChanges();
    const tela = fixture.nativeElement as HTMLElement;

    (tela.querySelector('[aria-label^="Visualizar"]') as HTMLButtonElement).click();
    expect(component['drawerAberto']()).toBe(true);
    expect(component['somenteLeitura']()).toBe(true);
    fixture.detectChanges();
    const fechar = Array.from(
      tela.querySelectorAll('.cfg-form-footer button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent?.trim() === 'Fechar');
    fechar?.click();
    expect(component['drawerAberto']()).toBe(false);
    controller.match(() => true).forEach((req) => req.flush(null));

    component['drawerAberto'].set(false);
    (tela.querySelector('[aria-label^="Editar"]') as HTMLButtonElement).click();
    expect(component['somenteLeitura']()).toBe(false);
  });

  it('CA-02: desativar confirmado vai à API e recarrega a lista; o foco passa ao título dela', async () => {
    atenderFases();
    controller.expectOne((r) => r.url === LISTA).flush([fatoDoAdministrador]);
    await propagar();

    component['pedirAtivacao'](fatoDoAdministrador, 'DESATIVAR');
    // O diálogo fecha ao confirmar.
    component['confirmacaoAberta'].set(false);
    component['confirmarAtivacao']();
    controller
      .expectOne((r) => r.method === 'DELETE' && r.url === `${LISTA}/${fatoDoAdministrador.id}`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await propagar();

    controller.expectOne((r) => r.url === LISTA).flush([]);
    expect(document.activeElement?.id).toBe('cfg-fatos-list-title');
  });

  it('CA-02: reativar leva a chave de idempotência, e a recusa reabre a confirmação com a mensagem da API', async () => {
    atenderFases();
    controller.expectOne((r) => r.url === LISTA).flush([{ ...fatoDoAdministrador, ativo: false }]);
    await propagar();

    component['pedirAtivacao']({ ...fatoDoAdministrador, ativo: false }, 'REATIVAR');
    // O diálogo fecha ao confirmar.
    component['confirmacaoAberta'].set(false);
    component['confirmarAtivacao']();
    const ativacao = controller.expectOne(`${LISTA}/${fatoDoAdministrador.id}/ativacao`);
    expect(ativacao.request.headers.has('Idempotency-Key')).toBe(true);
    ativacao.flush(
      JSON.stringify({ status: 422, code: 'uniplus.configuracao.fato_candidato.ja_ativo', title: 'O fato já está ativo.' }),
      PROBLEMA(422),
    );
    await propagar();

    expect(component['confirmacaoAberta']()).toBe(true);
    expect(component['mensagemDaConfirmacao']()).not.toContain('Deseja reativar');
  });

  describe('aprovação da proteção de dados', () => {
    const fatoCom = (situacao: string, classificacaoRecomendada: string | null = null) => ({
      ...fatoDoAdministrador,
      aprovacao: { situacao, solicitadaEm: null, decididaEm: null, classificacaoRecomendada, aceitaEm: null },
    });
    const pendencia = (id: string) => ({
      tipo: 'FATO',
      id,
      codigo: 'TRABALHA',
      nome: 'Trabalha',
      classificacaoProtecao: 'PESSOAL',
      finalidadeTratamento: 'Classificar a reserva de vagas.',
      hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
      aprovacao: { situacao: 'PENDENTE', solicitadaEm: null, decididaEm: null, classificacaoRecomendada: null, aceitaEm: null },
    });
    const botaoDaPagina = (host: HTMLElement, rotulo: string) =>
      Array.from<HTMLButtonElement>(host.querySelectorAll('.panel-head__actions button, td button')).find((b) =>
        b.textContent?.includes(rotulo),
      );

    async function carregarCom(fatos: readonly unknown[], pendencias: readonly unknown[] = []): Promise<HTMLElement> {
      atenderFases();
      controller.expectOne((r) => r.url === LISTA).flush(fatos);
      atenderPendencias(pendencias);
      await propagar();
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    it('diz a situação como texto e, na negativa, a classificação recomendada, inclusive no fato de sistema', async () => {
      const host = await carregarCom([{ ...fatoCom('NEGADA', 'SENSIVEL'), sistema: true }]);

      const texto = host.textContent?.replace(/\s+/gu, ' ') ?? '';
      expect(texto).toContain('Negada pela proteção de dados');
      expect(texto).toContain('Classificação recomendada: Pessoal sensível');
      expect(botaoDaPagina(host, 'Aceitar recomendação')).toBeDefined();
    });

    it('a recusa do aceite relê a lista e a situação, e reabre o diálogo com a mensagem da API', async () => {
      const host = await carregarCom([fatoCom('NEGADA', 'SENSIVEL')]);
      botaoDaPagina(host, 'Aceitar recomendação')?.click();
      component['confirmarAceite']();
      controller.expectOne(`${LISTA}/${fatoDoAdministrador.id}/aceite-da-recomendacao`).flush(
        JSON.stringify({ status: 409, code: 'uniplus.configuracao.protecao_do_catalogo.conflito_de_concorrencia', title: 'O fato foi alterado ao mesmo tempo' }),
        { status: 409, statusText: 'Conflito', headers: { 'content-type': 'application/problem+json' } },
      );
      await propagar();

      controller.expectOne((r) => r.url === LISTA).flush([fatoCom('PENDENTE')]);
      atenderPendencias();
      await propagar();
      expect(component['confirmAceiteAberto']()).toBe(true);
      expect(component['mensagemDoAceite']()).toBe('O fato foi alterado ao mesmo tempo');
    });

    it('aceita a recomendação do fato negado e recarrega a lista', async () => {
      const host = await carregarCom([fatoCom('NEGADA', 'SENSIVEL')]);
      botaoDaPagina(host, 'Aceitar recomendação')?.click();
      fixture.detectChanges();
      expect(component['mensagemDoAceite']()).toContain('Pessoal sensível');

      component['confirmarAceite']();
      const post = controller.expectOne(`${LISTA}/${fatoDoAdministrador.id}/aceite-da-recomendacao`);
      expect(post.request.method).toBe('POST');
      expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
      post.flush(null, { status: 204, statusText: 'No Content' });
      await propagar();

      controller.expectOne((r) => r.url === LISTA).flush([fatoCom('APROVADA')]);
      atenderPendencias();
      await propagar();
      fixture.detectChanges();
      expect(botaoDaPagina(host, 'Aceitar recomendação')).toBeUndefined();
    });

    it('sem a permissão de manter não oferece "Aceitar recomendação" nem "Enviar solicitação"', async () => {
      concedidas.set(['configuracao:fatos-candidato:consultar']);
      const host = await carregarCom([fatoCom('NEGADA', 'SENSIVEL')], [pendencia(fatoDoAdministrador.id)]);

      expect(botaoDaPagina(host, 'Aceitar recomendação')).toBeUndefined();
      expect(botaoDaPagina(host, 'Enviar solicitação')).toBeUndefined();
    });

    it('oferece "Enviar solicitação" com fato pendente e a envia de uma vez', async () => {
      const host = await carregarCom([fatoCom('PENDENTE')], [pendencia(fatoDoAdministrador.id)]);
      botaoDaPagina(host, 'Enviar solicitação')?.click();
      fixture.detectChanges();

      expect(host.querySelector('cfg-solicitacao-da-protecao-dialog')?.textContent).toContain('Trabalha');
      Array.from<HTMLButtonElement>(host.querySelectorAll('cfg-solicitacao-da-protecao-dialog button'))
        .find((b) => b.textContent?.includes('Enviar solicitação'))
        ?.click();

      const post = controller.expectOne(`${PROTECAO}/solicitacoes`);
      expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
      post.flush({ tiposDeDocumento: 0, fatos: 1 });
      await propagar();

      controller.expectOne((r) => r.url === LISTA).flush([fatoCom('SOLICITADA')]);
      atenderPendencias();
      await propagar();
      fixture.detectChanges();
      expect(botaoDaPagina(host, 'Enviar solicitação')).toBeUndefined();
    });

    it('quem só consulta não pede a lista de pendências, que a API recusa e levaria ao acesso negado', async () => {
      concedidas.set(['configuracao:fatos-candidato:consultar']);
      await carregarCom([fatoCom('APROVADA')]);

      controller.expectNone((r) => r.url === PROTECAO);
    });

    it('criar ou editar um fato relê as pendências, e "Enviar solicitação" aparece com o fato novo', async () => {
      const host = await carregarCom([]);
      expect(botaoDaPagina(host, 'Enviar solicitação')).toBeUndefined();

      component['recarregar']();
      await propagar();
      controller.expectOne((r) => r.url === LISTA).flush([fatoCom('PENDENTE')]);
      atenderPendencias([pendencia(fatoDoAdministrador.id)]);
      await propagar();
      fixture.detectChanges();

      expect(botaoDaPagina(host, 'Enviar solicitação')).toBeDefined();
    });

    it('depois do envio, o foco vai ao título da lista, e não ao botão que some com a releitura', async () => {
      const host = await carregarCom([fatoCom('PENDENTE')], [pendencia(fatoDoAdministrador.id)]);
      botaoDaPagina(host, 'Enviar solicitação')?.click();
      fixture.detectChanges();
      Array.from<HTMLButtonElement>(host.querySelectorAll('cfg-solicitacao-da-protecao-dialog button'))
        .find((b) => b.textContent?.includes('Enviar solicitação'))
        ?.click();
      controller.expectOne(`${PROTECAO}/solicitacoes`).flush({ tiposDeDocumento: 0, fatos: 1 });
      await propagar();
      controller.expectOne((r) => r.url === LISTA).flush([fatoCom('SOLICITADA')]);
      atenderPendencias();
      await propagar();
      fixture.detectChanges();
      await propagar();

      expect(document.activeElement?.id).toBe('cfg-fatos-list-title');
    });

    it('não oferece "Enviar solicitação" sem fato pendente', async () => {
      const host = await carregarCom([fatoCom('SOLICITADA')]);

      expect(botaoDaPagina(host, 'Enviar solicitação')).toBeUndefined();
    });
  });
});
