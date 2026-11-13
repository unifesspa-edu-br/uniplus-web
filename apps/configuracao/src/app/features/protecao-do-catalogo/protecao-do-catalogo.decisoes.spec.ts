import { HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { buildVendorMimeAccept } from '@uniplus/shared-core/http';
import type { DecisaoDaProtecaoDto } from '@uniplus/shared-data/configuracao';
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
  detalheDoLaudo,
  laudo,
  montarPagina,
  navegarNaPagina,
  problema as recusa,
  type PaginaMontada,
} from './protecao-do-catalogo.testing';

describe('ProtecaoDoCatalogoPage — páginas e detalhe das decisões', () => {
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

  const LINK = '</api/x?cursor=PROX&direction=next>; rel="next"';
  const router = (): Router => TestBed.inject(Router);
  const navegar = (): Promise<void> => navegarNaPagina(pagina);
  const abrirAba = (
    consulta: string,
    itens: readonly DecisaoDaProtecaoDto[] = [decisaoDoFato, decisaoDoTipo],
    cabecalhos: Record<string, string> = {},
  ): Promise<HTMLElement> => abrirAbaDeDecisoes(pagina, consulta, itens, cabecalhos);
  /** O texto do elemento com os espaços normalizados; vazio quando ele não existe. */
  const textoDe = (elemento: Element | null | undefined): string =>
    elemento?.textContent?.replace(/\s+/gu, ' ').trim() ?? '';
  const botoes = (tela: HTMLElement, texto: string): HTMLButtonElement[] =>
    Array.from(tela.querySelectorAll<HTMLButtonElement>('button')).filter(
      (b) => b.textContent?.trim() === texto,
    );

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
    expect(controller.expectOne((r) => r.url === DECISOES).request.params.get('limit')).toBe('50');
  });

  it('sem resultado, com filtro, oferece limpar os filtros e a URL volta ao início da aba', async () => {
    const tela = await abrirAba('?aba=decisoes&cadastro=FATO&minhas=true', []);
    expect(tela.textContent).toContain('Nenhuma decisão encontrada');

    botoes(tela, 'Limpar filtros')[0].click();
    await navegar();
    expect(router().url).toBe('/?aba=decisoes');
    controller
      .expectOne((r) => r.url === DECISOES && !r.params.has('cadastro') && !r.params.has('minhas'))
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
      atos: [
        {
          ...decisaoDoTipo,
          ato: 'SOLICITACAO',
          atorNome: 'Isabella Moura',
          classificacaoRecomendada: null,
          justificativa: null,
        },
        decisaoDoTipo,
        {
          ...decisaoDoTipo,
          ato: 'ACEITE',
          atorNome: 'Isabella Moura',
          classificacaoRecomendada: null,
          justificativa: null,
        },
      ],
    });
    await assentar();

    const painel = tela.querySelector('dialog[aria-label="Detalhe da decisão"]');
    const texto = textoDe(painel);
    expect(textoDe(painel?.querySelector('.uni-drawer__title'))).toBe('Laudo médico complementar');
    expect(texto).toContain('Ajuste recomendado');
    expect(texto).toContain('Decidido porCaroline Ribeiro');
    expect(texto).toContain('Classificação recomendadaPessoal');
    expect(texto).toContain('JustificativaO laudo identifica o candidato.');
    expect(texto).toContain('Proteção conferida');
    expect(texto).toContain('Execução de políticas públicas');
    const historico = Array.from(painel?.querySelectorAll('.cfg-atos__item') ?? [], textoDe);
    expect(historico).toHaveLength(3);
    expect(historico[0]).toContain('Solicitação');
    expect(historico[2]).toContain('Aceite da recomendação');
    expect(textoDe(painel?.querySelector('.form-drawer__footer button'))).toBe('Fechar');
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
