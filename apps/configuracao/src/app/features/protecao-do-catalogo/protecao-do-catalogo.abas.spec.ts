import { HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { buildVendorMimeAccept } from '@uniplus/shared-core/http';
import type {
  DecisaoDaProtecaoDto,
  ItemDaProtecaoDoCatalogoDto,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProtecaoDoCatalogoPage } from './protecao-do-catalogo.page';
import {
  APROVAR,
  URL_DA_FILA as URL,
  URL_DAS_DECISOES as DECISOES,
  abrirAbaDeDecisoes,
  clicar,
  decisaoDoFato,
  decisaoDoTipo,
  laudo,
  montarPagina,
  navegarNaPagina,
  type PaginaMontada,
} from './protecao-do-catalogo.testing';

describe('ProtecaoDoCatalogoPage — abas e decisões registradas', () => {
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

  const router = (): Router => TestBed.inject(Router);
  const navegar = (): Promise<void> => navegarNaPagina(pagina);
  const esperar = (ms: number): Promise<void> =>
    new Promise((resolver) => setTimeout(resolver, ms));
  const abrirAba = (
    consulta: string,
    itens: readonly DecisaoDaProtecaoDto[] = [decisaoDoFato, decisaoDoTipo],
    cabecalhos: Record<string, string> = {},
  ): Promise<HTMLElement> => abrirAbaDeDecisoes(pagina, consulta, itens, cabecalhos);
  const botoes = (tela: HTMLElement, texto: string): HTMLButtonElement[] =>
    Array.from(tela.querySelectorAll<HTMLButtonElement>('button')).filter(
      (b) => b.textContent?.trim() === texto,
    );
  const decisoesPendentes = () => controller.match((r) => r.url === DECISOES);

  describe('abas e a lista de aguardando', () => {
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
    controller.expectOne((r) => r.url === DECISOES && r.params.get('minhas') === 'true').flush([]);
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
    const campo = tela.querySelector<HTMLInputElement>('input[type="search"]') as HTMLInputElement;

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
});
