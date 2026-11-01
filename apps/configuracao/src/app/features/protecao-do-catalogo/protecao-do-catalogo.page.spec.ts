import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor, buildVendorMimeAccept } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  type DetalheDaProtecaoDoCatalogoDto,
  type ItemDaProtecaoDoCatalogoDto,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProtecaoDoCatalogoPage } from './protecao-do-catalogo.page';

const BASE = 'http://localhost:5000';
const URL = `${BASE}/api/configuracao/admin/protecao-do-catalogo`;
const URL_CATEGORIAS = `${BASE}/api/configuracao/categorias-documento`;
const APROVAR = 'configuracao:protecao-do-catalogo:aprovar';
const concedidas = signal<readonly string[]>([APROVAR]);

const SOLICITADA = {
  situacao: 'SOLICITADA',
  solicitadaEm: '2026-11-01T12:00:00Z',
  decididaEm: null,
  classificacaoRecomendada: null,
  justificativa: null,
  aceitaEm: null,
};

const laudo: ItemDaProtecaoDoCatalogoDto = {
  tipo: 'TIPO_DOCUMENTO',
  id: '01960000-0000-7000-0000-0000000000d2',
  codigo: 'LAUDO_MEDICO_COMPLEMENTAR',
  nome: 'Laudo médico complementar',
  classificacaoProtecao: 'INTERNO',
  finalidadeTratamento: 'Conferir o laudo do candidato com deficiência.',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  aprovacao: SOLICITADA,
};

const rural: ItemDaProtecaoDoCatalogoDto = {
  ...laudo,
  tipo: 'FATO',
  id: '01960000-0000-7000-0000-0000000000d3',
  codigo: 'RESIDE_EM_AREA_RURAL',
  nome: 'Reside em área rural',
  classificacaoProtecao: 'PESSOAL',
};

/** O detalhe do tipo de documento, como a API o devolve. */
const detalheDoLaudo: DetalheDaProtecaoDoCatalogoDto = {
  ...laudo,
  descricao: 'Laudo que complementa o pedido de atendimento especializado.',
  fato: null,
  tipoDocumento: { categoria: 'SAUDE', formatosAceitos: 'pdf,jpg', tamanhoMaximoMb: 10 },
};

/** O detalhe do fato de texto, que não admite classificação abaixo de pessoal. */
const detalheDoFato = (extra: Partial<DetalheDaProtecaoDoCatalogoDto> = {}): DetalheDaProtecaoDoCatalogoDto => ({
  ...rural,
  descricao: 'Se o candidato mora em área rural.',
  tipoDocumento: null,
  fato: {
    dominio: 'CATEGORICO',
    cardinalidade: 'ESCALAR',
    sistema: false,
    componenteExibicao: null,
    valores: [
      { codigo: 'SIM_RURAL', descricao: 'Mora em área rural', orientacao: 'Considere o endereço do comprovante.' },
      { codigo: 'NAO_RURAL', descricao: 'Não mora em área rural', orientacao: null },
    ],
  },
  ...extra,
});

const recusa = (status: number, code: string, title: string) =>
  [
    JSON.stringify({ status, code, title }),
    { status, statusText: 'Recusa', headers: { 'content-type': 'application/problem+json' } },
  ] as const;

describe('ProtecaoDoCatalogoPage', () => {
  let fixture: ComponentFixture<ProtecaoDoCatalogoPage>;
  let component: ProtecaoDoCatalogoPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    concedidas.set([APROVAR]);
    TestBed.configureTestingModule({
      imports: [ProtecaoDoCatalogoPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: PermissoesService, useValue: { tem: (codigo: string) => concedidas().includes(codigo) } },
      ],
    });
    fixture = TestBed.createComponent(ProtecaoDoCatalogoPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => {
    controller.match((r) => r.url === URL_CATEGORIAS).forEach((req) => req.flush([]));
    controller.verify();
  });

  const assentar = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
    fixture.detectChanges();
  };

  async function carregar(itens: readonly ItemDaProtecaoDoCatalogoDto[]): Promise<HTMLElement> {
    const req = controller.expectOne((r) => r.url === URL);
    expect(req.request.params.get('situacao'), 'só o que aguarda a decisão').toBe('SOLICITADA');
    req.flush(itens);
    await assentar();
    return fixture.nativeElement as HTMLElement;
  }

  /** Abre o detalhe pelo nome na linha e o atende com a resposta da API. */
  async function abrir(
    tela: HTMLElement,
    item: ItemDaProtecaoDoCatalogoDto,
    detalhe: DetalheDaProtecaoDoCatalogoDto,
  ): Promise<void> {
    tela.querySelector<HTMLButtonElement>(`td button[aria-label="Ver o detalhe de ${item.nome}"]`)?.click();
    fixture.detectChanges();
    const segmento = item.tipo === 'FATO' ? 'fatos' : 'tipos-documento';
    controller.expectOne(`${URL}/${segmento}/${item.id}`).flush(detalhe);
    await assentar();
  }

  const drawer = (tela: HTMLElement) => tela.querySelector('dialog[aria-label^="Detalhe do item"]');
  const botaoDoRodape = (tela: HTMLElement, nome: string): HTMLButtonElement | undefined =>
    Array.from(drawer(tela)?.querySelectorAll<HTMLButtonElement>('.cfg-form-footer button') ?? []).find(
      (b) => b.textContent?.trim() === nome,
    );
  const dialogo = (tela: HTMLElement) => tela.querySelector('ui-dialog dialog');
  const confirmar = (tela: HTMLElement, rotulo: string): HTMLButtonElement | undefined =>
    Array.from(dialogo(tela)?.querySelectorAll<HTMLButtonElement>('.uni-dialog__footer button') ?? []).find(
      (b) => b.textContent?.trim() === rotulo,
    );
  const campoDaJustificativa = (tela: HTMLElement): HTMLTextAreaElement =>
    tela.querySelector('dialog textarea') as HTMLTextAreaElement;
  const digitar = (campo: HTMLTextAreaElement, texto: string): void => {
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  it('lista só Cadastro, Item e Sensibilidade, sem código, hipótese, finalidade nem botões', async () => {
    const tela = await carregar([laudo, rural]);

    expect(Array.from(tela.querySelectorAll('thead th')).map((th) => th.textContent?.trim())).toEqual([
      'Cadastro',
      'Item',
      'Sensibilidade',
    ]);
    const lista = tela.querySelector('.table-responsive')?.textContent?.replace(/\s+/gu, ' ') ?? '';
    expect(lista).toContain('Laudo médico complementar');
    expect(lista).toContain('Interno');
    expect(lista).toContain('Fato do candidato');
    expect(lista).not.toContain('LAUDO_MEDICO_COMPLEMENTAR');
    expect(lista).not.toContain('Execução de políticas públicas');
    expect(lista).not.toContain('Conferir o laudo');
    expect(tela.querySelector('td button.btn')).toBeNull();
    expect(Array.from(tela.querySelectorAll('tbody td')).every((td) => td.classList.contains('u-nowrap-desktop'))).toBe(true);
  });

  it('o texto de abertura é curto e não cita o rótulo interno do requisito', async () => {
    const tela = await carregar([laudo]);

    const abertura = tela.querySelector('.page-header__desc')?.textContent ?? '';
    expect(abertura).not.toContain('UNI-REQ');
    expect(abertura.trim().split('.').filter(Boolean)).toHaveLength(1);
  });

  it('o nome da linha é um botão nativo que abre o detalhe lido da API', async () => {
    const tela = await carregar([laudo]);
    const alvo = tela.querySelector<HTMLButtonElement>('td .table-responsive__alvo');
    expect(alvo?.tagName).toBe('BUTTON');
    expect(alvo?.tabIndex).toBeGreaterThanOrEqual(0);

    alvo?.click();
    fixture.detectChanges();
    const pedido = controller.expectOne(`${URL}/tipos-documento/${laudo.id}`);
    expect(pedido.request.headers.get('Accept')).toBe(buildVendorMimeAccept('protecao-do-catalogo-detalhe', 1));
    pedido.flush(detalheDoLaudo);
    await assentar();

    expect(drawer(tela)?.querySelector('.uni-drawer__title')?.textContent?.trim()).toBe('Laudo médico complementar');
  });

  it('o detalhe do tipo de documento mostra a proposta, o que é o item e o código só ao fim', async () => {
    const tela = await carregar([laudo]);
    await abrir(tela, laudo, detalheDoLaudo);

    const texto = drawer(tela)?.textContent?.replace(/\s+/gu, ' ') ?? '';
    expect(texto).toContain('Proposta de proteção');
    expect(texto).toContain('Interno');
    expect(texto).toContain('Execução de políticas públicas');
    expect(texto).toContain('Conferir o laudo do candidato com deficiência.');
    expect(texto).toContain('O que é o item');
    expect(texto).toContain('Laudo que complementa o pedido de atendimento especializado.');
    expect(texto).toContain('pdf,jpg');
    expect(texto).toContain('10 MB');
    expect(texto).toContain('Em análise');
    expect(texto).toContain('Código no sistema: LAUDO_MEDICO_COMPLEMENTAR');
    expect(texto.indexOf('Código no sistema')).toBeGreaterThan(texto.indexOf('O que é o item'));
    expect(texto.indexOf('O que é o item')).toBeGreaterThan(texto.indexOf('Proposta de proteção'));
    expect(Array.from(drawer(tela)?.querySelectorAll('.cfg-form-footer button') ?? []).map((b) => b.textContent?.trim())).toEqual([
      'Fechar',
      'Reprovar',
      'Recomendar ajuste',
      'Aprovar',
    ]);
  });

  it('o detalhe do fato mostra o tipo do dado, a cardinalidade e os valores possíveis com a orientação', async () => {
    const tela = await carregar([rural]);
    await abrir(tela, rural, detalheDoFato());

    const texto = drawer(tela)?.textContent?.replace(/\s+/gu, ' ') ?? '';
    expect(texto).toContain('Se o candidato mora em área rural.');
    expect(texto).toContain('Lista de valores');
    expect(texto).toContain('Um valor');
    expect(texto).toContain('Mora em área rural');
    expect(texto).toContain('Considere o endereço do comprovante.');
  });

  it('item inexistente mostra "Item não encontrado" no próprio drawer, sem ações de decisão', async () => {
    const tela = await carregar([laudo]);
    tela.querySelector<HTMLButtonElement>('td .table-responsive__alvo')?.click();
    fixture.detectChanges();
    controller
      .expectOne(`${URL}/tipos-documento/${laudo.id}`)
      .flush(...recusa(404, 'uniplus.configuracao.protecao_do_catalogo.item_nao_encontrado', 'Item não encontrado'));
    await assentar();

    const painel = drawer(tela);
    expect(painel?.textContent).toContain('Item não encontrado');
    expect(painel?.textContent).toContain('O item não existe mais no catálogo.');
    expect(botaoDoRodape(tela, 'Aprovar')).toBeUndefined();
    expect(botaoDoRodape(tela, 'Fechar')).toBeDefined();
  });

  it('item que não está em análise não oferece decisão', async () => {
    const tela = await carregar([laudo]);
    await abrir(tela, laudo, { ...detalheDoLaudo, aprovacao: { ...SOLICITADA, situacao: 'APROVADA' } });

    expect(botaoDoRodape(tela, 'Aprovar')).toBeUndefined();
    expect(botaoDoRodape(tela, 'Reprovar')).toBeUndefined();
  });

  it('aprovar leva a proteção conferida, com Idempotency-Key; o drawer fecha e a lista é relida', async () => {
    const tela = await carregar([laudo]);
    await abrir(tela, laudo, detalheDoLaudo);
    botaoDoRodape(tela, 'Aprovar')?.click();

    const post = controller.expectOne((r) => r.method === 'POST' && r.url === URL);
    expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
    expect(post.request.body).toMatchObject({
      cadastro: 'TIPO_DOCUMENTO',
      itemId: laudo.id,
      decisao: 'APROVAR',
      classificacaoProtecao: 'INTERNO',
      hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
      finalidadeTratamento: 'Conferir o laudo do candidato com deficiência.',
    });
    post.flush(null, { status: 204, statusText: 'No Content' });
    await assentar();

    controller.expectOne((r) => r.method === 'GET' && r.url === URL).flush([]);
    await assentar();
    expect(tela.textContent).toContain('Nenhum item aguardando a sua decisão');
    expect(component['detalheAberto']()).toBe(false);
    expect(document.activeElement?.id).toBe('cfg-protecao-titulo');
  });

  describe('recomendar ajuste', () => {
    const abrirDialogo = async (item = laudo, detalhe = detalheDoLaudo): Promise<HTMLElement> => {
      const tela = await carregar([item]);
      await abrir(tela, item, detalhe);
      botaoDoRodape(tela, 'Recomendar ajuste')?.click();
      fixture.detectChanges();
      return tela;
    };

    it('sem a classificação recomendada não envia, pede a classificação e leva o foco ao seletor', async () => {
      const tela = await abrirDialogo();
      await assentar();

      confirmar(tela, 'Recomendar ajuste')?.click();
      fixture.detectChanges();
      await assentar();

      controller.expectNone((r) => r.method === 'POST');
      expect(tela.querySelector('#cfg-ajuste-erro')?.textContent).toContain('Indique a classificação recomendada.');
      const campo = dialogo(tela)?.querySelector('select');
      expect(document.activeElement, 'o foco vai ao seletor').toBe(campo);
      expect(campo?.getAttribute('aria-describedby')).toContain('cfg-ajuste-erro');
    });

    it('oferece só a classificação que a hipótese legal e o tipo do dado admitem, sem a atual', async () => {
      const tela = await abrirDialogo();

      const opcoes = Array.from(dialogo(tela)?.querySelectorAll<HTMLOptionElement>('select option') ?? []).map((o) => o.value);
      expect(opcoes).toContain('SENSIVEL');
      expect(opcoes).not.toContain('INTERNO');
    });

    it('no fato de texto não oferece classificação abaixo de pessoal, que a API também recusa', async () => {
      const tela = await abrirDialogo(
        rural,
        detalheDoFato({
          classificacaoProtecao: 'SENSIVEL',
          fato: { dominio: 'TEXTO', cardinalidade: 'ESCALAR', sistema: false, componenteExibicao: null, valores: [] },
        }),
      );

      const opcoes = Array.from(dialogo(tela)?.querySelectorAll<HTMLOptionElement>('select option') ?? []).map((o) => o.value);
      expect(opcoes).toContain('PESSOAL');
      expect(opcoes).not.toContain('PUBLICO');
      expect(opcoes).not.toContain('INTERNO');
    });

    it('não oferece a classificação que a hipótese legal declarada não admite', async () => {
      const tela = await abrirDialogo(laudo, {
        ...detalheDoLaudo,
        classificacaoProtecao: 'PESSOAL',
        hipoteseLegal: 'INTERESSE_LEGITIMO',
      });

      const opcoes = Array.from(dialogo(tela)?.querySelectorAll<HTMLOptionElement>('select option') ?? []).map((o) => o.value);
      expect(opcoes, 'interesse legítimo é só do art. 7º: o dado sensível não o admite').not.toContain('SENSIVEL');
      expect(opcoes).toContain('INTERNO');
    });

    it('envia a classificação recomendada com a justificativa aparada, que é opcional', async () => {
      const tela = await abrirDialogo();
      component['recomendada'].setValue('SENSIVEL');
      digitar(campoDaJustificativa(tela), '  O laudo traz dado de saúde.  ');

      confirmar(tela, 'Recomendar ajuste')?.click();

      const post = controller.expectOne((r) => r.method === 'POST' && r.url === URL);
      expect(post.request.body).toMatchObject({
        decisao: 'RECOMENDAR_AJUSTE',
        classificacaoRecomendada: 'SENSIVEL',
        classificacaoProtecao: 'INTERNO',
        justificativa: 'O laudo traz dado de saúde.',
      });
      post.flush(null, { status: 204, statusText: 'No Content' });
      await assentar();
      controller.expectOne((r) => r.method === 'GET' && r.url === URL).flush([]);
    });

    it('sem justificativa envia o ajuste com a justificativa nula', async () => {
      const tela = await abrirDialogo();
      component['recomendada'].setValue('SENSIVEL');
      digitar(campoDaJustificativa(tela), '   ');

      confirmar(tela, 'Recomendar ajuste')?.click();

      const post = controller.expectOne((r) => r.method === 'POST' && r.url === URL);
      expect(post.request.body.justificativa).toBeNull();
      post.flush(null, { status: 204, statusText: 'No Content' });
      await assentar();
      controller.expectOne((r) => r.method === 'GET' && r.url === URL).flush([]);
    });

    it('a recusa da API fica no diálogo, com a mensagem, e a lista não é relida', async () => {
      const tela = await abrirDialogo();
      component['recomendada'].setValue('PUBLICO');
      confirmar(tela, 'Recomendar ajuste')?.click();

      controller
        .expectOne((r) => r.method === 'POST' && r.url === URL)
        .flush(
          ...recusa(
            422,
            'uniplus.configuracao.protecao_do_catalogo.recomendacao_incompativel_com_a_hipotese_legal',
            'A base legal do item não cabe na classificação recomendada',
          ),
        );
      await assentar();

      expect(component['decisaoAberta']()).toBe(true);
      expect(component['erroDaDecisaoNoDialogo']()).toBe('A base legal do item não cabe na classificação recomendada');
    });
  });

  describe('reprovar', () => {
    const abrirDialogo = async (): Promise<HTMLElement> => {
      const tela = await carregar([laudo]);
      await abrir(tela, laudo, detalheDoLaudo);
      botaoDoRodape(tela, 'Reprovar')?.click();
      fixture.detectChanges();
      return tela;
    };

    it('exige a justificativa: em branco não envia, o erro fica associado ao campo e o foco vai a ele', async () => {
      const tela = await abrirDialogo();
      digitar(campoDaJustificativa(tela), '   ');

      confirmar(tela, 'Reprovar item')?.click();
      fixture.detectChanges();
      await assentar();

      controller.expectNone((r) => r.method === 'POST');
      const campo = campoDaJustificativa(tela);
      expect(tela.querySelector('#cfg-justificativa-erro')?.textContent).toContain('Informe a justificativa da reprovação.');
      expect(campo.getAttribute('aria-invalid')).toBe('true');
      expect(campo.getAttribute('aria-describedby')).toContain('cfg-justificativa-erro');
      expect(campo.getAttribute('aria-required')).toBe('true');
      expect(document.activeElement).toBe(campo);
    });

    it('o campo limita a 2.000 caracteres e o contador diz "N de 2.000"', async () => {
      const tela = await abrirDialogo();

      expect(campoDaJustificativa(tela).getAttribute('maxlength')).toBe('2000');
      expect(tela.querySelector('#cfg-justificativa-contador')?.textContent?.trim()).toBe('0 de 2.000');
      digitar(campoDaJustificativa(tela), 'Falta a base legal.');
      expect(tela.querySelector('#cfg-justificativa-contador')?.textContent?.trim()).toBe('19 de 2.000');
    });

    it('acima de 2.000 caracteres não envia e informa o limite no campo', async () => {
      const tela = await abrirDialogo();
      digitar(campoDaJustificativa(tela), 'a'.repeat(2001));

      confirmar(tela, 'Reprovar item')?.click();
      fixture.detectChanges();

      controller.expectNone((r) => r.method === 'POST');
      expect(tela.querySelector('#cfg-justificativa-erro')?.textContent).toContain('A justificativa aceita até 2.000 caracteres.');
    });

    it('envia a justificativa aparada, sem classificação recomendada', async () => {
      const tela = await abrirDialogo();
      digitar(campoDaJustificativa(tela), '  Falta a base legal.  ');

      confirmar(tela, 'Reprovar item')?.click();

      const post = controller.expectOne((r) => r.method === 'POST' && r.url === URL);
      expect(post.request.body).toMatchObject({ decisao: 'REPROVAR', justificativa: 'Falta a base legal.' });
      expect(post.request.body.classificacaoRecomendada).toBeUndefined();
      post.flush(null, { status: 204, statusText: 'No Content' });
      await assentar();
      controller.expectOne((r) => r.method === 'GET' && r.url === URL).flush([]);
    });

    it('o diálogo não repete o código técnico do item', async () => {
      const tela = await abrirDialogo();

      const texto = dialogo(tela)?.textContent ?? '';
      expect(texto).toContain('Laudo médico complementar');
      expect(texto).not.toContain('LAUDO_MEDICO_COMPLEMENTAR');
    });
  });

  it('a leitura nova cancela a em voo: a resposta velha não prevalece', async () => {
    await carregar([]);
    component['carregar']();
    const velha = controller.expectOne((r) => r.method === 'GET' && r.url === URL);
    component['carregar']();
    expect(velha.cancelled).toBe(true);
    controller.expectOne((r) => r.method === 'GET' && r.url === URL).flush([laudo]);
    await assentar();

    expect(component['itens']()).toEqual([laudo]);
  });

  it('quando a proteção mudou, não repete a decisão: relê a lista e avisa para decidir de novo', async () => {
    const tela = await carregar([laudo]);
    await abrir(tela, laudo, detalheDoLaudo);
    botaoDoRodape(tela, 'Aprovar')?.click();

    controller
      .expectOne((r) => r.method === 'POST' && r.url === URL)
      .flush(
        ...recusa(
          409,
          'uniplus.configuracao.protecao_do_catalogo.protecao_alterada',
          'A proteção do item mudou desde a leitura',
        ),
      );
    await assentar();

    controller.expectOne((r) => r.method === 'GET' && r.url === URL).flush([{ ...laudo, classificacaoProtecao: 'SENSIVEL' }]);
    await assentar();
    expect(tela.textContent).toContain('A proteção do item mudou desde a leitura');
    expect(tela.textContent).toContain('Pessoal sensível');
    expect(component['detalheAberto']()).toBe(false);
    controller.expectNone((r) => r.method === 'POST');
  });

  it('item que já saiu da solicitação (decidido por outra pessoa) relê a lista em vez de manter os botões', async () => {
    const tela = await carregar([laudo]);
    await abrir(tela, laudo, detalheDoLaudo);
    botaoDoRodape(tela, 'Aprovar')?.click();

    controller
      .expectOne((r) => r.method === 'POST' && r.url === URL)
      .flush(
        ...recusa(
          422,
          'uniplus.configuracao.protecao_do_catalogo.item_fora_de_solicitacao',
          'O item não está numa solicitação da proteção de dados',
        ),
      );
    await assentar();

    controller.expectOne((r) => r.method === 'GET' && r.url === URL).flush([]);
    await assentar();
    expect(botaoDoRodape(tela, 'Aprovar')).toBeUndefined();
  });

  it('a recusa de uma aprovação fica no drawer, sem fechá-lo', async () => {
    const tela = await carregar([laudo]);
    await abrir(tela, laudo, detalheDoLaudo);
    botaoDoRodape(tela, 'Aprovar')?.click();

    controller
      .expectOne((r) => r.method === 'POST' && r.url === URL)
      .flush(...recusa(422, 'uniplus.configuracao.protecao_do_catalogo.hipotese_incompativel', 'A hipótese legal não cabe na classificação'));
    await assentar();

    expect(component['detalheAberto']()).toBe(true);
    expect(drawer(tela)?.textContent).toContain('A hipótese legal não cabe na classificação');
  });

  it('a mesma decisão repetida depois de erro do servidor reusa a chave; a recusa 4xx troca a chave', async () => {
    const tela = await carregar([laudo]);
    await abrir(tela, laudo, detalheDoLaudo);
    const falha = (status: number) =>
      [JSON.stringify({ status, title: 'Falha' }), { status, statusText: 'Falha', headers: { 'content-type': 'application/problem+json' } }] as const;
    const postar = () => {
      botaoDoRodape(tela, 'Aprovar')?.click();
      return controller.expectOne((r) => r.method === 'POST' && r.url === URL);
    };

    const primeira = postar();
    const chave = primeira.request.headers.get('Idempotency-Key');
    primeira.flush(...falha(503));
    await assentar();

    const segunda = postar();
    expect(segunda.request.headers.get('Idempotency-Key')).toBe(chave);
    segunda.flush(...falha(422));
    await assentar();

    const terceira = postar();
    expect(terceira.request.headers.get('Idempotency-Key')).not.toBe(chave);
    terceira.flush(null, { status: 204, statusText: 'No Content' });
    await assentar();
    controller.expectOne((r) => r.method === 'GET' && r.url === URL).flush([]);
  });

  it('sem a permissão de aprovar, abre o detalhe mas não oferece decisão', async () => {
    concedidas.set([]);
    const tela = await carregar([laudo]);
    await abrir(tela, laudo, detalheDoLaudo);

    expect(botaoDoRodape(tela, 'Aprovar')).toBeUndefined();
    expect(botaoDoRodape(tela, 'Recomendar ajuste')).toBeUndefined();
    expect(botaoDoRodape(tela, 'Reprovar')).toBeUndefined();
    expect(drawer(tela)?.querySelector('.uni-drawer__title')?.textContent?.trim()).toBe('Laudo médico complementar');
  });
});
