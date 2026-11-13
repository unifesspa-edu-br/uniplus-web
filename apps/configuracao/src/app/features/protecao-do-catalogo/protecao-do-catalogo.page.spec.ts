import { EdicaoDaProtecaoDoCatalogo } from './edicao-da-protecao-do-catalogo';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor, buildVendorMimeAccept } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  type DecisaoDaProtecaoDto,
  type DetalheDaProtecaoDoCatalogoDto,
  type ItemDaProtecaoDoCatalogoDto,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProtecaoDoCatalogoPage } from './protecao-do-catalogo.page';
import { ProtecaoDoCatalogoStore } from './protecao-do-catalogo.store';

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
  ciclo: 1,
  manifestadaEm: null,
  manifestacaoDesfavoravel: false,
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
  manifestacoesVigentes: [],
  atos: [],
};

/** O detalhe do fato de texto, que não admite classificação abaixo de pessoal. */
const detalheDoFato = (
  extra: Partial<DetalheDaProtecaoDoCatalogoDto> = {},
): DetalheDaProtecaoDoCatalogoDto => ({
  ...rural,
  descricao: 'Se o candidato mora em área rural.',
  tipoDocumento: null,
  manifestacoesVigentes: [],
  atos: [],
  fato: {
    dominio: 'CATEGORICO',
    cardinalidade: 'ESCALAR',
    sistema: false,
    componenteExibicao: null,
    valores: [
      {
        codigo: 'SIM_RURAL',
        descricao: 'Mora em área rural',
        orientacao: 'Considere o endereço do comprovante.',
      },
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
        {
          provide: PermissoesService,
          useValue: { tem: (codigo: string) => concedidas().includes(codigo) },
        },
      ],
    });
    fixture = TestBed.createComponent(ProtecaoDoCatalogoPage);
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => {
    controller.match((r) => r.url === URL_CATEGORIAS).forEach((req) => req.flush([]));
    controller.verify();
  });

  function clicar(alvo: HTMLElement | null | undefined): void {
    expect(alvo, 'o alvo do clique existe').toBeTruthy();
    (alvo as HTMLElement).click();
  }

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
    clicar(
      tela.querySelector<HTMLButtonElement>(
        `td button[aria-label="Ver o detalhe de ${item.nome}"]`,
      ),
    );
    fixture.detectChanges();
    const segmento = item.tipo === 'FATO' ? 'fatos' : 'tipos-documento';
    controller.expectOne(`${URL}/${segmento}/${item.id}`).flush(detalhe);
    await assentar();
  }

  const drawer = (tela: HTMLElement) => tela.querySelector('dialog[aria-label^="Detalhe do item"]');
  const botaoDoRodape = (tela: HTMLElement, nome: string): HTMLButtonElement | undefined =>
    Array.from(
      drawer(tela)?.querySelectorAll<HTMLButtonElement>('.form-drawer__footer button') ?? [],
    ).find((b) => b.textContent?.trim() === nome);
  const dialogo = (tela: HTMLElement) => tela.querySelector('ui-dialog dialog');
  const confirmar = (tela: HTMLElement, rotulo: string): HTMLButtonElement | undefined =>
    Array.from(
      dialogo(tela)?.querySelectorAll<HTMLButtonElement>('.uni-dialog__footer button') ?? [],
    ).find((b) => b.textContent?.trim() === rotulo);
  const campoDaJustificativa = (tela: HTMLElement): HTMLTextAreaElement =>
    tela.querySelector('dialog textarea') as HTMLTextAreaElement;
  const digitar = (campo: HTMLTextAreaElement, texto: string): void => {
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  it('lista só Cadastro, Item e Sensibilidade, sem código, hipótese, finalidade nem botões', async () => {
    const tela = await carregar([laudo, rural]);

    expect(
      Array.from(tela.querySelectorAll('thead th')).map((th) => th.textContent?.trim()),
    ).toEqual(['Cadastro', 'Item', 'Sensibilidade']);
    const lista = tela.querySelector('.table-responsive')?.textContent?.replace(/\s+/gu, ' ') ?? '';
    expect(lista).toContain('Laudo médico complementar');
    expect(lista).toContain('Interno');
    expect(lista).toContain('Fato do candidato');
    expect(lista).not.toContain('LAUDO_MEDICO_COMPLEMENTAR');
    expect(lista).not.toContain('Execução de políticas públicas');
    expect(lista).not.toContain('Conferir o laudo');
    expect(tela.querySelector('td button.btn')).toBeNull();
    expect(
      Array.from(tela.querySelectorAll('tbody td')).every((td) =>
        td.classList.contains('u-nowrap-desktop'),
      ),
    ).toBe(true);
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

    clicar(alvo);
    fixture.detectChanges();
    const pedido = controller.expectOne(`${URL}/tipos-documento/${laudo.id}`);
    expect(pedido.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('protecao-do-catalogo-detalhe', 1),
    );
    pedido.flush(detalheDoLaudo);
    await assentar();

    expect(drawer(tela)?.querySelector('.uni-drawer__title')?.textContent?.trim()).toBe(
      'Laudo médico complementar',
    );
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
    expect(
      Array.from(drawer(tela)?.querySelectorAll('.form-drawer__footer button') ?? []).map((b) =>
        b.textContent?.trim(),
      ),
    ).toEqual(['Fechar', 'Reprovar', 'Recomendar ajuste', 'Aprovar']);
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
    clicar(tela.querySelector<HTMLButtonElement>('td .table-responsive__alvo'));
    fixture.detectChanges();
    controller
      .expectOne(`${URL}/tipos-documento/${laudo.id}`)
      .flush(
        ...recusa(
          404,
          'uniplus.configuracao.protecao_do_catalogo.item_nao_encontrado',
          'Item não encontrado',
        ),
      );
    await assentar();

    const painel = drawer(tela);
    expect(painel?.textContent).toContain('Item não encontrado');
    expect(painel?.textContent).toContain('O item não existe mais no catálogo.');
    expect(painel?.textContent).not.toContain('Tentar novamente');
    expect(botaoDoRodape(tela, 'Aprovar')).toBeUndefined();
    expect(botaoDoRodape(tela, 'Fechar')).toBeDefined();
  });

  it('item que não está em análise não oferece decisão', async () => {
    const tela = await carregar([laudo]);
    await abrir(tela, laudo, {
      ...detalheDoLaudo,
      aprovacao: { ...SOLICITADA, situacao: 'APROVADA' },
    });

    expect(botaoDoRodape(tela, 'Aprovar')).toBeUndefined();
    expect(botaoDoRodape(tela, 'Reprovar')).toBeUndefined();
  });

  it('aprovar leva a proteção conferida, com Idempotency-Key; o drawer fecha e a lista é relida', async () => {
    const tela = await carregar([laudo]);
    await abrir(tela, laudo, detalheDoLaudo);
    clicar(botaoDoRodape(tela, 'Aprovar'));

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
    expect(fixture.debugElement.injector.get(EdicaoDaProtecaoDoCatalogo).detalheAberto()).toBe(
      false,
    );
    expect(document.activeElement?.id).toBe('cfg-protecao-titulo');
  });

  it('bloqueia novas decisões e o fechamento enquanto a gravação está pendente', async () => {
    const tela = await carregar([laudo]);
    await abrir(tela, laudo, detalheDoLaudo);
    const edicao = fixture.debugElement.injector.get(EdicaoDaProtecaoDoCatalogo);
    edicao.aprovar();
    const post = controller.expectOne((r) => r.method === 'POST' && r.url === URL);

    edicao.aprovar();
    edicao.abrirDecisao('REPROVAR');
    edicao.fecharDetalhe();
    expect(edicao.detalheAberto()).toBe(true);
    expect(edicao.decisaoAberta()).toBe(false);
    controller.expectNone((r) => r.method === 'POST');

    post.flush(null, { status: 204, statusText: 'No Content' });
    await assentar();
    controller.expectOne((r) => r.method === 'GET' && r.url === URL).flush([]);
    await assentar();
    expect(edicao.detalheAberto()).toBe(false);
  });

  describe('recomendar ajuste', () => {
    const abrirDialogo = async (item = laudo, detalhe = detalheDoLaudo): Promise<HTMLElement> => {
      const tela = await carregar([item]);
      await abrir(tela, item, detalhe);
      clicar(botaoDoRodape(tela, 'Recomendar ajuste'));
      fixture.detectChanges();
      return tela;
    };

    it('sem a classificação recomendada não envia, pede a classificação e leva o foco ao seletor', async () => {
      const tela = await abrirDialogo();
      await assentar();

      clicar(confirmar(tela, 'Recomendar ajuste'));
      fixture.detectChanges();
      await assentar();

      controller.expectNone((r) => r.method === 'POST');
      expect(tela.querySelector('#cfg-ajuste-erro')?.textContent).toContain(
        'Indique a classificação recomendada.',
      );
      const campo = dialogo(tela)?.querySelector('select');
      expect(document.activeElement, 'o foco vai ao seletor').toBe(campo);
      expect(campo?.getAttribute('aria-describedby')).toContain('cfg-ajuste-erro');
    });

    it('oferece só a classificação que a hipótese legal e o tipo do dado admitem, sem a atual', async () => {
      const tela = await abrirDialogo();

      const opcoes = Array.from(
        dialogo(tela)?.querySelectorAll<HTMLOptionElement>('select option') ?? [],
      ).map((o) => o.value);
      expect(opcoes).toContain('SENSIVEL');
      expect(opcoes).not.toContain('INTERNO');
    });

    it('no fato de texto não oferece classificação abaixo de pessoal, que a API também recusa', async () => {
      const tela = await abrirDialogo(
        rural,
        detalheDoFato({
          classificacaoProtecao: 'SENSIVEL',
          fato: {
            dominio: 'TEXTO',
            cardinalidade: 'ESCALAR',
            sistema: false,
            componenteExibicao: null,
            valores: [],
          },
        }),
      );

      const opcoes = Array.from(
        dialogo(tela)?.querySelectorAll<HTMLOptionElement>('select option') ?? [],
      ).map((o) => o.value);
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

      const opcoes = Array.from(
        dialogo(tela)?.querySelectorAll<HTMLOptionElement>('select option') ?? [],
      ).map((o) => o.value);
      expect(
        opcoes,
        'interesse legítimo é só do art. 7º: o dado sensível não o admite',
      ).not.toContain('SENSIVEL');
      expect(opcoes).toContain('INTERNO');
    });

    it('envia a classificação recomendada com a justificativa aparada, que é opcional', async () => {
      const tela = await abrirDialogo();
      fixture.debugElement.injector
        .get(EdicaoDaProtecaoDoCatalogo)
        .recomendada.setValue('SENSIVEL');
      digitar(campoDaJustificativa(tela), '  O laudo traz dado de saúde.  ');

      clicar(confirmar(tela, 'Recomendar ajuste'));

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
      fixture.debugElement.injector
        .get(EdicaoDaProtecaoDoCatalogo)
        .recomendada.setValue('SENSIVEL');
      digitar(campoDaJustificativa(tela), '   ');

      clicar(confirmar(tela, 'Recomendar ajuste'));

      const post = controller.expectOne((r) => r.method === 'POST' && r.url === URL);
      expect(post.request.body.justificativa).toBeNull();
      post.flush(null, { status: 204, statusText: 'No Content' });
      await assentar();
      controller.expectOne((r) => r.method === 'GET' && r.url === URL).flush([]);
    });

    it('a recusa da API fica no diálogo, com a mensagem, e a lista não é relida', async () => {
      const tela = await abrirDialogo();
      fixture.debugElement.injector.get(EdicaoDaProtecaoDoCatalogo).recomendada.setValue('PUBLICO');
      clicar(confirmar(tela, 'Recomendar ajuste'));

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

      expect(fixture.debugElement.injector.get(EdicaoDaProtecaoDoCatalogo).decisaoAberta()).toBe(
        true,
      );
      expect(
        fixture.debugElement.injector.get(EdicaoDaProtecaoDoCatalogo).erroDaDecisaoNoDialogo(),
      ).toBe('A base legal do item não cabe na classificação recomendada');
    });
  });

  describe('reprovar', () => {
    const abrirDialogo = async (): Promise<HTMLElement> => {
      const tela = await carregar([laudo]);
      await abrir(tela, laudo, detalheDoLaudo);
      clicar(botaoDoRodape(tela, 'Reprovar'));
      fixture.detectChanges();
      return tela;
    };

    it('mantém a decisão em andamento acessível e impede uma segunda gravação', async () => {
      const tela = await abrirDialogo();
      const campo = campoDaJustificativa(tela);
      digitar(campo, 'Falta a base legal.');
      const botao = confirmar(tela, 'Reprovar item') as HTMLButtonElement;
      botao.focus();
      botao.click();
      fixture.detectChanges();
      const requisicao = controller.expectOne((r) => r.url === URL && r.method === 'POST');

      expect(campo.matches(':disabled')).toBe(true);
      expect(campo.value).toBe('Falta a base legal.');
      expect(botao.getAttribute('aria-disabled')).toBe('true');
      expect(botao.getAttribute('aria-busy')).toBe('true');
      expect(document.activeElement).toBe(botao);
      expect(dialogo(tela)?.querySelector('[role="status"]')?.textContent).toContain(
        'Registrando decisão',
      );
      botao.click();
      controller.expectNone((r) => r.url === URL && r.method === 'POST');
      requisicao.flush(null);
      await assentar();
      controller.expectOne((r) => r.url === URL && r.method === 'GET').flush([]);
      await assentar();
    });

    it('exige a justificativa: em branco não envia, o erro fica associado ao campo e o foco vai a ele', async () => {
      const tela = await abrirDialogo();
      digitar(campoDaJustificativa(tela), '   ');

      clicar(confirmar(tela, 'Reprovar item'));
      fixture.detectChanges();
      await assentar();

      controller.expectNone((r) => r.method === 'POST');
      const campo = campoDaJustificativa(tela);
      expect(tela.querySelector('#cfg-justificativa-erro')?.textContent).toContain(
        'Informe a justificativa da reprovação.',
      );
      expect(campo.getAttribute('aria-invalid')).toBe('true');
      expect(campo.getAttribute('aria-describedby')).toContain('cfg-justificativa-erro');
      expect(campo.getAttribute('aria-required')).toBe('true');
      expect(document.activeElement).toBe(campo);
    });

    it('o campo limita a 2.000 caracteres e o contador diz "N de 2.000"', async () => {
      const tela = await abrirDialogo();

      expect(campoDaJustificativa(tela).getAttribute('maxlength')).toBe('2000');
      expect(tela.querySelector('#cfg-justificativa-contador')?.textContent?.trim()).toBe(
        '0 de 2.000',
      );
      digitar(campoDaJustificativa(tela), 'Falta a base legal.');
      expect(tela.querySelector('#cfg-justificativa-contador')?.textContent?.trim()).toBe(
        '19 de 2.000',
      );
    });

    it('acima de 2.000 caracteres não envia e informa o limite no campo', async () => {
      const tela = await abrirDialogo();
      digitar(campoDaJustificativa(tela), 'a'.repeat(2001));

      clicar(confirmar(tela, 'Reprovar item'));
      fixture.detectChanges();

      controller.expectNone((r) => r.method === 'POST');
      expect(tela.querySelector('#cfg-justificativa-erro')?.textContent).toContain(
        'A justificativa aceita até 2.000 caracteres.',
      );
    });

    it('envia a justificativa aparada, sem classificação recomendada', async () => {
      const tela = await abrirDialogo();
      digitar(campoDaJustificativa(tela), '  Falta a base legal.  ');

      clicar(confirmar(tela, 'Reprovar item'));

      const post = controller.expectOne((r) => r.method === 'POST' && r.url === URL);
      expect(post.request.body).toMatchObject({
        decisao: 'REPROVAR',
        justificativa: 'Falta a base legal.',
      });
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
    const tela = await carregar([]);
    const store = fixture.debugElement.injector.get(ProtecaoDoCatalogoStore);
    store.carregar();
    await assentar();
    const velha = controller.expectOne((r) => r.method === 'GET' && r.url === URL);
    store.carregar();
    await assentar();
    expect(velha.cancelled).toBe(true);
    controller.expectOne((r) => r.method === 'GET' && r.url === URL).flush([laudo]);
    await assentar();

    expect(tela.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(tela.querySelector('tbody')?.textContent).toContain(laudo.nome);
  });

  it('quando a proteção mudou, não repete a decisão: relê a lista e avisa para decidir de novo', async () => {
    const tela = await carregar([laudo]);
    await abrir(tela, laudo, detalheDoLaudo);
    clicar(botaoDoRodape(tela, 'Aprovar'));

    controller
      .expectOne((r) => r.method === 'POST' && r.url === URL)
      .flush(
        ...recusa(
          409,
          'uniplus.configuracao.protecao_do_catalogo.protecao_mudou',
          'A proteção do item mudou desde a leitura',
        ),
      );
    await assentar();

    controller
      .expectOne((r) => r.method === 'GET' && r.url === URL)
      .flush([{ ...laudo, classificacaoProtecao: 'SENSIVEL' }]);
    await assentar();
    expect(tela.textContent).toContain('A proteção do item mudou desde a leitura');
    expect(tela.textContent).toContain('Pessoal sensível');
    expect(fixture.debugElement.injector.get(EdicaoDaProtecaoDoCatalogo).detalheAberto()).toBe(
      false,
    );
    controller.expectNone((r) => r.method === 'POST');
  });

  it('item que já saiu da solicitação (decidido por outra pessoa) relê a lista em vez de manter os botões', async () => {
    const tela = await carregar([laudo]);
    await abrir(tela, laudo, detalheDoLaudo);
    clicar(botaoDoRodape(tela, 'Aprovar'));

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
    clicar(botaoDoRodape(tela, 'Aprovar'));

    controller
      .expectOne((r) => r.method === 'POST' && r.url === URL)
      .flush(
        ...recusa(
          422,
          'uniplus.configuracao.protecao_do_catalogo.hipotese_incompativel',
          'A hipótese legal não cabe na classificação',
        ),
      );
    await assentar();

    expect(fixture.debugElement.injector.get(EdicaoDaProtecaoDoCatalogo).detalheAberto()).toBe(
      true,
    );
    expect(drawer(tela)?.textContent).toContain('A hipótese legal não cabe na classificação');
  });

  it('a mesma decisão repetida depois de erro do servidor reusa a chave; a recusa 4xx troca a chave', async () => {
    const tela = await carregar([laudo]);
    await abrir(tela, laudo, detalheDoLaudo);
    const falha = (status: number) =>
      [
        JSON.stringify({ status, title: 'Falha' }),
        { status, statusText: 'Falha', headers: { 'content-type': 'application/problem+json' } },
      ] as const;
    const postar = () => {
      clicar(botaoDoRodape(tela, 'Aprovar'));
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
    expect(drawer(tela)?.querySelector('.uni-drawer__title')?.textContent?.trim()).toBe(
      'Laudo médico complementar',
    );
  });

  describe('abas e a lista de aguardando', () => {
    const router = (): Router => TestBed.inject(Router);

    it('ao abrir direto em ?aba=decisoes não lê a lista de aguardando decisão', async () => {
      controller.expectOne((r) => r.url === URL).flush([]);
      await router().navigateByUrl('/?aba=decisoes');
      await assentar();
      controller.expectOne((r) => r.url === `${URL}/decisoes`).flush([]);

      const outra = TestBed.createComponent(ProtecaoDoCatalogoPage);
      outra.detectChanges();
      controller.match((r) => r.url === `${URL}/decisoes`).forEach((req) => req.flush([]));
      await outra.whenStable();

      expect(controller.match((r) => r.url === URL)).toHaveLength(0);
      controller.match((r) => r.url === `${URL}/decisoes`).forEach((req) => req.flush([]));
    });

    it('ao voltar para "Aguardando decisão" relê a lista', async () => {
      controller.expectOne((r) => r.url === URL).flush([]);
      await router().navigateByUrl('/?aba=decisoes');
      await assentar();
      controller.expectOne((r) => r.url === `${URL}/decisoes`).flush([]);
      await assentar();

      const botao = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
      ).find((b) => b.textContent?.trim() === 'Aguardando decisão');
      clicar(botao);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await assentar();
      await assentar();

      controller
        .expectOne((r) => r.url === URL && r.params.get('situacao') === 'SOLICITADA')
        .flush([laudo]);
      await assentar();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        'Laudo médico complementar',
      );
    });
  });

  describe('aba Decisões', () => {
    const DECISOES = `${URL}/decisoes`;
    const decisaoDoFato: DecisaoDaProtecaoDto = {
      cadastro: 'FATO',
      itemId: rural.id,
      itemCodigo: 'RENDA_FAMILIAR_BRUTA',
      itemNome: 'Renda familiar bruta',
      ato: 'REPROVACAO',
      instante: '2026-10-31T13:00:00Z',
      atorNome: 'Betina Albuquerque',
      ciclo: 1,
      dianteDeManifestacaoDesfavoravel: false,
      classificacaoProtecao: 'PESSOAL',
      hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
      finalidadeTratamento: 'Conferir a renda familiar.',
      classificacaoRecomendada: null,
      justificativa: 'A renda familiar é dado sensível.',
    };
    const decisaoDoTipo: DecisaoDaProtecaoDto = {
      ...decisaoDoFato,
      cadastro: 'TIPO_DOCUMENTO',
      itemId: laudo.id,
      itemCodigo: laudo.codigo,
      itemNome: laudo.nome,
      ato: 'AJUSTE_RECOMENDADO',
      instante: '2026-10-30T15:00:00Z',
      atorNome: 'Caroline Ribeiro',
      ciclo: 1,
      dianteDeManifestacaoDesfavoravel: false,
      classificacaoProtecao: 'INTERNO',
      classificacaoRecomendada: 'PESSOAL',
      justificativa: 'O laudo identifica o candidato.',
    };
    const LINK = '</api/x?cursor=PROX&direction=next>; rel="next"';

    const router = (): Router => TestBed.inject(Router);
    /** A navegação do roteador termina em outra tarefa: espera por ela antes de olhar a tela. */
    const navegar = async (): Promise<void> => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await assentar();
      await assentar();
    };
    const esperar = (ms: number): Promise<void> =>
      new Promise((resolver) => setTimeout(resolver, ms));

    /** Abre a aba pelo endereço, como o link ou o botão de voltar a trazem, e atende a primeira página. */
    async function abrirAba(
      consulta: string,
      itens: readonly DecisaoDaProtecaoDto[] = [decisaoDoFato, decisaoDoTipo],
      cabecalhos: Record<string, string> = {},
    ): Promise<HTMLElement> {
      controller.expectOne((r) => r.url === URL).flush([]);
      await router().navigateByUrl(`/${consulta}`);
      await navegar();
      controller.expectOne((r) => r.url === DECISOES).flush(itens, { headers: cabecalhos });
      await assentar();
      return fixture.nativeElement as HTMLElement;
    }

    const botoes = (tela: HTMLElement, texto: string): HTMLButtonElement[] =>
      Array.from(tela.querySelectorAll<HTMLButtonElement>('button')).filter(
        (b) => b.textContent?.trim() === texto,
      );
    const decisoesPendentes = () => controller.match((r) => r.url === DECISOES);

    it('abre em "Aguardando decisão" e a troca de aba vai para a query string', async () => {
      const tela = await carregar([laudo]);
      expect(botoes(tela, 'Aguardando decisão')[0].getAttribute('aria-pressed')).toBe('true');
      expect(botoes(tela, 'Decisões')[0].getAttribute('aria-pressed')).toBe('false');
      expect(tela.querySelector('cfg-decisoes-da-protecao')).toBeNull();

      botoes(tela, 'Decisões')[0].click();
      await navegar();

      expect(router().url).toBe('/?aba=decisoes');
      expect(botoes(tela, 'Decisões')[0].getAttribute('aria-pressed')).toBe('true');
      expect(tela.querySelector('.page-header__desc')?.textContent).toContain(
        'decisões já registradas',
      );
      const pedido = controller.expectOne((r) => r.url === DECISOES);
      expect(pedido.request.params.get('limit')).toBe('25');
      expect(pedido.request.headers.get('Accept')).toBe(
        buildVendorMimeAccept('protecao-do-catalogo-decisao', 1),
      );
      pedido.flush([]);
    });

    it('lista Item, Cadastro, Decisão, Sensibilidade conferida e Data, sem quebra de linha no desktop', async () => {
      const tela = await abrirAba('?aba=decisoes');

      expect(
        Array.from(tela.querySelectorAll('thead th')).map((th) => th.textContent?.trim()),
      ).toEqual(['Item', 'Cadastro', 'Decisão', 'Sensibilidade conferida', 'Data']);
      const linha = Array.from(tela.querySelectorAll('tbody tr')).map((tr) =>
        tr.textContent?.replace(/\s+/gu, ' ').trim(),
      );
      expect(linha[0]).toBe('Renda familiar bruta Fato do candidato Reprovação Pessoal 31/10/2026');
      expect(linha[1]).toContain('Ajuste recomendado');
      expect(
        Array.from(tela.querySelectorAll('tbody td')).every((td) =>
          td.classList.contains('u-nowrap-desktop'),
        ),
      ).toBe(true);
      expect(tela.querySelector('tbody .table-responsive__alvo')?.getAttribute('aria-label')).toBe(
        'Ver a decisão sobre Renda familiar bruta',
      );
    });

    it('lê os filtros da URL, manda-os à API e os mostra marcados', async () => {
      controller.expectOne((r) => r.url === URL).flush([]);
      await router().navigateByUrl(
        '/?aba=decisoes&ato=REPROVACAO&ato=AJUSTE_RECOMENDADO&cadastro=FATO&de=2026-10-01&ate=2026-10-31&busca=renda&minhas=true&ato=INVALIDO',
      );
      await assentar();
      const pedido = controller.expectOne((r) => r.url === DECISOES);
      expect(pedido.request.params.getAll('ato')).toEqual(['AJUSTE_RECOMENDADO', 'REPROVACAO']);
      expect(pedido.request.params.get('cadastro')).toBe('FATO');
      expect(pedido.request.params.get('de')).toBe('2026-10-01');
      expect(pedido.request.params.get('ate')).toBe('2026-10-31');
      expect(pedido.request.params.get('busca')).toBe('renda');
      expect(pedido.request.params.get('minhas')).toBe('true');
      pedido.flush([decisaoDoFato]);
      await assentar();

      const tela = fixture.nativeElement as HTMLElement;
      expect(botoes(tela, 'Reprovado')[0].getAttribute('aria-pressed')).toBe('true');
      expect(botoes(tela, 'Ajuste recomendado')[0].getAttribute('aria-pressed')).toBe('true');
      expect(botoes(tela, 'Aprovado')[0].getAttribute('aria-pressed')).toBe('false');
      expect(botoes(tela, 'Fato do candidato')[0].getAttribute('aria-pressed')).toBe('true');
      expect(tela.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe('renda');
      expect(tela.querySelector<HTMLInputElement>('.checkbox input')?.checked).toBe(true);
      const datas = Array.from(tela.querySelectorAll<HTMLInputElement>('input[type="date"]')).map(
        (i) => i.value,
      );
      expect(datas).toEqual(['2026-10-01', '2026-10-31']);
      expect(
        tela.querySelector('.filter-bar__titulo')?.parentElement?.getAttribute('aria-label'),
      ).toContain('4 ativos');
    });

    it('escolher uma decisão, um cadastro e "só as minhas" atualiza a URL e relê a primeira página', async () => {
      const tela = await abrirAba('?aba=decisoes');

      botoes(tela, 'Reprovado')[0].click();
      await navegar();
      const reprovado = controller.expectOne((r) => r.url === DECISOES);
      expect(reprovado.request.params.getAll('ato')).toEqual(['REPROVACAO']);
      reprovado.flush([decisaoDoFato]);
      await assentar();
      expect(router().url).toBe('/?aba=decisoes&ato=REPROVACAO');

      botoes(tela, 'Fato do candidato')[0].click();
      await navegar();
      controller
        .expectOne((r) => r.url === DECISOES && r.params.get('cadastro') === 'FATO')
        .flush([decisaoDoFato]);
      await assentar();

      clicar(tela.querySelector<HTMLInputElement>('.checkbox input'));
      await navegar();
      controller
        .expectOne((r) => r.url === DECISOES && r.params.get('minhas') === 'true')
        .flush([]);
      await assentar();
      expect(router().url).toBe('/?aba=decisoes&ato=REPROVACAO&cadastro=FATO&minhas=true');

      botoes(tela, 'Reprovado')[0].click();
      await navegar();
      expect(router().url).toBe('/?aba=decisoes&cadastro=FATO&minhas=true');
      controller.expectOne((r) => r.url === DECISOES && !r.params.has('ato')).flush([]);
    });

    it('o período invertido cancela a busca em voo, zera a carga e o "Tentar novamente" não consulta', async () => {
      const tela = await abrirAba('?aba=decisoes');
      const [de, ate] = Array.from(tela.querySelectorAll<HTMLInputElement>('input[type="date"]'));

      de.value = '2026-10-15';
      de.dispatchEvent(new Event('change'));
      await navegar();
      const emVoo = controller.expectOne(
        (r) => r.url === DECISOES && r.params.get('de') === '2026-10-15',
      );
      ate.value = '2026-10-01';
      ate.dispatchEvent(new Event('change'));
      await navegar();
      await assentar();

      expect(emVoo.cancelled).toBe(true);
      expect(tela.querySelector('[aria-busy="true"]')).toBeNull();
      expect(tela.querySelector('tbody')).toBeNull();
      expect(decisoesPendentes()).toHaveLength(0);

      ate.value = '2026-10-20';
      ate.dispatchEvent(new Event('change'));
      await navegar();
      controller
        .expectOne((r) => r.url === DECISOES && r.params.get('ate') === '2026-10-20')
        .flush([decisaoDoFato]);
      await assentar();
      expect(tela.querySelector('tbody')?.textContent).toContain(decisaoDoFato.itemNome);
    });

    it('o período vai à API e a data final antes da inicial avisa sem pedir', async () => {
      const tela = await abrirAba('?aba=decisoes');
      const [de, ate] = Array.from(tela.querySelectorAll<HTMLInputElement>('input[type="date"]'));

      de.value = '2026-10-15';
      de.dispatchEvent(new Event('change'));
      await navegar();
      controller
        .expectOne((r) => r.url === DECISOES && r.params.get('de') === '2026-10-15')
        .flush([]);
      await assentar();

      ate.value = '2026-10-01';
      ate.dispatchEvent(new Event('change'));
      await navegar();
      expect(decisoesPendentes()).toHaveLength(0);
      expect(tela.querySelector('#cfg-dec-periodo-erro')?.textContent).toContain(
        'igual ou posterior',
      );
      expect(ate.getAttribute('aria-invalid')).toBe('true');
    });

    it('a busca espera a pessoa parar de digitar e vai à URL', async () => {
      const tela = await abrirAba('?aba=decisoes');
      const campo = tela.querySelector<HTMLInputElement>(
        'input[type="search"]',
      ) as HTMLInputElement;

      campo.value = 'ren';
      campo.dispatchEvent(new Event('input'));
      campo.value = 'renda';
      campo.dispatchEvent(new Event('input'));
      await esperar(50);
      expect(decisoesPendentes()).toHaveLength(0);

      await esperar(400);
      await assentar();
      controller
        .expectOne((r) => r.url === DECISOES && r.params.get('busca') === 'renda')
        .flush([decisaoDoFato]);
      await assentar();
      expect(router().url).toBe('/?aba=decisoes&busca=renda');
    });

    it('pagina pelo cursor do Link, reenviando os filtros, e volta pelo anterior', async () => {
      const tela = await abrirAba('?aba=decisoes&cadastro=FATO', [decisaoDoFato], { Link: LINK });

      clicar(botoes(tela, 'Próximo')[0]);
      await assentar();
      const proxima = controller.expectOne((r) => r.url === DECISOES);
      expect(proxima.request.params.get('cursor')).toBe('PROX');
      expect(proxima.request.params.get('direction')).toBe('next');
      expect(proxima.request.params.get('cadastro')).toBe('FATO');
      expect(proxima.request.params.has('limit')).toBe(false);
      proxima.flush([decisaoDoTipo], {
        headers: { Link: '</api/x?cursor=ANT&direction=prev>; rel="prev"' },
      });
      await assentar();
      expect(tela.querySelector('tbody')?.textContent).toContain('Laudo médico complementar');

      clicar(botoes(tela, 'Anterior')[0]);
      await assentar();
      const anterior = controller.expectOne((r) => r.url === DECISOES);
      expect(anterior.request.params.get('cursor')).toBe('ANT');
      expect(anterior.request.params.get('direction')).toBe('prev');
      anterior.flush([decisaoDoFato]);
    });

    it('trocar os itens por página relê a primeira página com o novo limit', async () => {
      const tela = await abrirAba('?aba=decisoes', [decisaoDoFato], { Link: LINK });

      const seletor = tela.querySelector<HTMLSelectElement>('ui-list-footer select');
      expect(seletor).not.toBeNull();
      (seletor as HTMLSelectElement).value = '50';
      (seletor as HTMLSelectElement).dispatchEvent(new Event('change'));
      await navegar();
      expect(controller.expectOne((r) => r.url === DECISOES).request.params.get('limit')).toBe(
        '50',
      );
    });

    it('sem resultado, com filtro, oferece limpar os filtros e a URL volta ao início da aba', async () => {
      const tela = await abrirAba('?aba=decisoes&cadastro=FATO&minhas=true', []);
      expect(tela.textContent).toContain('Nenhuma decisão encontrada');

      botoes(tela, 'Limpar filtros')[0].click();
      await navegar();
      expect(router().url).toBe('/?aba=decisoes');
      controller
        .expectOne(
          (r) => r.url === DECISOES && !r.params.has('cadastro') && !r.params.has('minhas'),
        )
        .flush([]);
      await assentar();
      expect(tela.textContent).toContain('Nenhuma decisão registrada');
    });

    it('na falha do servidor mostra o motivo e tenta de novo', async () => {
      controller.expectOne((r) => r.url === URL).flush([]);
      await router().navigateByUrl('/?aba=decisoes');
      await assentar();
      controller
        .expectOne((r) => r.url === DECISOES)
        .flush(...recusa(503, 'uniplus.internal.unexpected', 'Servidor indisponível'));
      await assentar();
      const tela = fixture.nativeElement as HTMLElement;
      expect(tela.textContent).toContain('Não foi possível carregar as decisões');
      expect(tela.textContent).toContain('Servidor indisponível');

      botoes(tela, 'Tentar novamente')[0].click();
      await assentar();
      controller.expectOne((r) => r.url === DECISOES).flush([decisaoDoFato]);
      await assentar();
      expect(tela.querySelector('tbody')?.textContent).toContain('Renda familiar bruta');
    });

    it('na recusa por falta de permissão mostra o motivo sem oferecer nova tentativa', async () => {
      controller.expectOne((r) => r.url === URL).flush([]);
      await router().navigateByUrl('/?aba=decisoes');
      await assentar();
      controller
        .expectOne((r) => r.url === DECISOES)
        .flush(...recusa(403, 'uniplus.auth.proibido', 'Sem permissão'));
      await assentar();
      const tela = fixture.nativeElement as HTMLElement;

      expect(tela.textContent).toContain('Sem permissão');
      expect(tela.textContent).not.toContain('Tentar novamente');
    });

    it('clicar na linha abre a decisão, a proteção conferida e o histórico completo lido do detalhe', async () => {
      const tela = await abrirAba('?aba=decisoes', [decisaoDoTipo]);

      clicar(tela.querySelector<HTMLButtonElement>('tbody .table-responsive__alvo'));
      await assentar();
      const detalhe = controller.expectOne(`${URL}/tipos-documento/${laudo.id}`);
      expect(detalhe.request.headers.get('Accept')).toBe(
        buildVendorMimeAccept('protecao-do-catalogo-detalhe', 1),
      );
      detalhe.flush({
        ...detalheDoLaudo,
        manifestacoesVigentes: [],
        atos: [
          {
            ...decisaoDoTipo,
            ato: 'SOLICITACAO',
            atorNome: 'Isabella Moura',
            ciclo: 1,
            dianteDeManifestacaoDesfavoravel: false,
            classificacaoRecomendada: null,
            justificativa: null,
          },
          decisaoDoTipo,
          {
            ...decisaoDoTipo,
            ato: 'ACEITE',
            atorNome: 'Isabella Moura',
            ciclo: 1,
            dianteDeManifestacaoDesfavoravel: false,
            classificacaoRecomendada: null,
            justificativa: null,
          },
        ],
      });
      await assentar();

      const painel = tela.querySelector('dialog[aria-label="Detalhe da decisão"]');
      const texto = painel?.textContent?.replace(/\s+/gu, ' ') ?? '';
      expect(painel?.querySelector('.uni-drawer__title')?.textContent?.trim()).toBe(
        'Laudo médico complementar',
      );
      expect(texto).toContain('Ajuste recomendado');
      expect(texto).toContain('Decidido porCaroline Ribeiro');
      expect(texto).toContain('Classificação recomendadaPessoal');
      expect(texto).toContain('JustificativaO laudo identifica o candidato.');
      expect(texto).toContain('Proteção conferida');
      expect(texto).toContain('Execução de políticas públicas');
      const historico = Array.from(painel?.querySelectorAll('.cfg-atos__item') ?? []).map((i) =>
        i.textContent?.replace(/\s+/gu, ' '),
      );
      expect(historico).toHaveLength(3);
      expect(historico[0]).toContain('Solicitação');
      expect(historico[2]).toContain('Aceite da recomendação');
      expect(painel?.querySelector('.form-drawer__footer button')?.textContent?.trim()).toBe(
        'Fechar',
      );
    });

    it('se o item não existe mais, mantém a decisão e explica no histórico', async () => {
      const tela = await abrirAba('?aba=decisoes', [decisaoDoTipo]);

      clicar(tela.querySelector<HTMLButtonElement>('tbody .table-responsive__alvo'));
      await assentar();
      controller
        .expectOne(`${URL}/tipos-documento/${laudo.id}`)
        .flush(...recusa(404, 'uniplus.nao_encontrado', 'Não encontrado'));
      await assentar();

      const texto =
        tela
          .querySelector('dialog[aria-label="Detalhe da decisão"]')
          ?.textContent?.replace(/\s+/gu, ' ') ?? '';
      expect(texto).toContain('Decidido porCaroline Ribeiro');
      expect(texto).toContain('O item não existe mais no catálogo.');
      expect(texto).not.toContain('Tentar novamente');
    });
  });
});
