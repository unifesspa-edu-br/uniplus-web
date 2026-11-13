import { HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { buildVendorMimeAccept } from '@uniplus/shared-core/http';
import type {
  DetalheDaProtecaoDoCatalogoDto,
  ItemDaProtecaoDoCatalogoDto,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EdicaoDaProtecaoDoCatalogo } from './edicao-da-protecao-do-catalogo';
import { ProtecaoDoCatalogoPage } from './protecao-do-catalogo.page';
import { ProtecaoDoCatalogoStore } from './protecao-do-catalogo.store';
import {
  APROVAR,
  SOLICITADA,
  URL_DA_FILA as URL,
  abrirItem,
  botaoDoRodape,
  clicar,
  detalheDoFato,
  detalheDoLaudo,
  drawerDoItem as drawer,
  laudo,
  montarPagina,
  problema as recusa,
  rural,
  type PaginaMontada,
} from './protecao-do-catalogo.testing';

describe('ProtecaoDoCatalogoPage — fila, detalhe e aprovação', () => {
  const concedidas = signal<readonly string[]>([APROVAR]);
  let pagina: PaginaMontada;
  let fixture: ComponentFixture<ProtecaoDoCatalogoPage>;
  let controller: HttpTestingController;
  let assentar: () => Promise<void>;

  beforeEach(() => {
    concedidas.set([APROVAR]);
    pagina = montarPagina(concedidas);
    ({ fixture, controller, assentar } = pagina);
  });

  afterEach(() => pagina.encerrar());

  async function carregar(itens: readonly ItemDaProtecaoDoCatalogoDto[]): Promise<HTMLElement> {
    const req = controller.expectOne((r) => r.url === URL);
    expect(req.request.params.get('situacao'), 'só o que aguarda a decisão').toBe('SOLICITADA');
    req.flush(itens);
    await assentar();
    return fixture.nativeElement as HTMLElement;
  }

  const abrir = (
    _tela: HTMLElement,
    item: ItemDaProtecaoDoCatalogoDto,
    detalhe: DetalheDaProtecaoDoCatalogoDto,
  ): Promise<void> => abrirItem(pagina, item, detalhe);

  it('lista Cadastro, Item, Sensibilidade, Ciclo e Manifestação, sem código, hipótese, finalidade nem botões', async () => {
    const tela = await carregar([laudo, rural]);

    expect(
      Array.from(tela.querySelectorAll('thead th')).map((th) => th.textContent?.trim()),
    ).toEqual(['Cadastro', 'Item', 'Sensibilidade', 'Ciclo', 'Manifestação']);
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
    expect(painel?.textContent).toContain('O tipo de documento ou o fato do candidato não existe mais.');
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
});
