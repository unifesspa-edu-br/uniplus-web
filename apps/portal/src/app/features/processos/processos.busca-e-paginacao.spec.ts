import type { HttpRequest } from '@angular/common/http';
import { SituacaoDoCertame } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CERTAMES_URL,
  CenarioDaVitrine,
  contadoresComProximaPagina,
  contadoresHeaders,
  sisu,
  tecnicoEnfermagem,
} from './processos.testing';
import { ESPERA_DA_BUSCA_MS } from './vitrine-de-certames';

const comBusca = (requisicao: HttpRequest<unknown>): boolean =>
  requisicao.url === CERTAMES_URL && requisicao.params.has('q');

describe('ProcessosComponent — busca e paginação', () => {
  let cenario: CenarioDaVitrine;

  beforeEach(() => {
    cenario = new CenarioDaVitrine();
  });

  afterEach(() => cenario.encerrar());

  it('busca server-side: digitação em rajada dispara um único GET com q após o debounce, na primeira página', async () => {
    await cenario.responderLista([sisu, tecnicoEnfermagem], contadoresHeaders);

    cenario.vitrine().termoBusca.set('t');
    cenario.vitrine().termoBusca.set('te');
    cenario.vitrine().termoBusca.set('tecnico');
    await cenario.passarOTempo(ESPERA_DA_BUSCA_MS - 1);
    cenario.controller.expectNone(comBusca);

    await cenario.passarOTempo(1);
    const requisicao = cenario.controller.expectOne(comBusca);
    expect(requisicao.request.params.get('q')).toBe('tecnico');
    expect(requisicao.request.params.has('cursor')).toBe(false);
    requisicao.flush([tecnicoEnfermagem], { headers: contadoresHeaders });
    await cenario.propagar();
    expect(cenario.vitrine().certames()).toHaveLength(1);
    // Sem hero enquanto há busca ativa.
    expect(cenario.vitrine().destaque()).toBeNull();
  });

  it('filtro por situação dispara GET com situacao e reseta a paginação', async () => {
    await cenario.responderLista([sisu, tecnicoEnfermagem], contadoresHeaders);

    cenario.chip('Últimos dias')?.click();
    cenario.fixture.detectChanges();

    const requisicao = cenario.controller.expectOne(
      (requisicao) => requisicao.url === CERTAMES_URL && requisicao.params.has('situacao'),
    );
    expect(requisicao.request.params.get('situacao')).toBe(SituacaoDoCertame.ultimosDias);
    expect(requisicao.request.params.has('cursor')).toBe(false);
    requisicao.flush([tecnicoEnfermagem], { headers: contadoresHeaders });
    await cenario.propagar();
    expect(cenario.vitrine().certames()).toEqual([tecnicoEnfermagem]);
  });

  it('"Limpar filtros" reseta busca e situação, refazendo a request sem elas', async () => {
    await cenario.responderLista([sisu, tecnicoEnfermagem], contadoresHeaders);

    cenario.vitrine().termoBusca.set('tecnico');
    await cenario.passarOTempo(ESPERA_DA_BUSCA_MS);
    await cenario.responderLista([tecnicoEnfermagem], contadoresHeaders);

    expect(cenario.vitrine().temFiltrosAtivos()).toBe(true);
    cenario.botao('Limpar filtros')?.click();
    cenario.fixture.detectChanges();
    // `termoBusca` limpo também passa pelo debounce antes de virar `buscaAplicada`.
    await cenario.passarOTempo(ESPERA_DA_BUSCA_MS);

    const requisicao = cenario.controller.expectOne(
      (requisicao) => requisicao.url === CERTAMES_URL,
    );
    expect(requisicao.request.params.has('q')).toBe(false);
    expect(requisicao.request.params.has('situacao')).toBe(false);
    requisicao.flush([sisu, tecnicoEnfermagem], { headers: contadoresHeaders });
    await cenario.propagar();
    expect(cenario.vitrine().temFiltrosAtivos()).toBe(false);
  });

  it('"Limpar filtros" sem filtro aplicado não apaga o texto que ainda espera o debounce', async () => {
    await cenario.responderLista([sisu], contadoresHeaders);
    cenario.vitrine().termoBusca.set('tecn');
    cenario.fixture.detectChanges();

    cenario.botao('Limpar filtros')?.click();

    expect(cenario.vitrine().termoBusca()).toBe('tecn');
    await cenario.passarOTempo(ESPERA_DA_BUSCA_MS);
    cenario.controller
      .expectOne(
        (requisicao) => requisicao.url === CERTAMES_URL && requisicao.params.get('q') === 'tecn',
      )
      .flush([sisu]);
    await cenario.propagar();
  });

  it('"Limpar filtros" acionado mantém o foco no botão, que passa a indisponível sem sair da ordem de tab', async () => {
    await cenario.responderLista([sisu, tecnicoEnfermagem], contadoresHeaders);
    cenario.vitrine().termoBusca.set('tecnico');
    await cenario.passarOTempo(ESPERA_DA_BUSCA_MS);
    await cenario.responderLista([tecnicoEnfermagem], contadoresHeaders);
    const limpar = cenario.botao('Limpar filtros');
    limpar?.focus();

    limpar?.click();
    await cenario.passarOTempo(ESPERA_DA_BUSCA_MS);
    cenario.fixture.detectChanges();

    expect(document.activeElement).toBe(limpar);
    expect(limpar?.getAttribute('aria-disabled')).toBe('true');
    expect(limpar?.disabled).toBe(false);
    await cenario.responderLista([sisu], contadoresHeaders);
  });

  it('pagina os resultados: Próximo segue o cursor do Link e Anterior volta', async () => {
    await cenario.responderLista([sisu], contadoresComProximaPagina);

    expect(cenario.vitrine().hasPrevious()).toBe(false);
    expect(cenario.vitrine().hasNext()).toBe(true);

    cenario.vitrine().proximaPagina();
    await cenario.propagar();

    const requisicao = cenario.controller.expectOne(
      (requisicao) => requisicao.url === CERTAMES_URL,
    );
    expect(requisicao.request.params.get('cursor')).toBe('p2');
    expect(requisicao.request.params.get('direction')).toBe('next');
    requisicao.flush([tecnicoEnfermagem], {
      headers: {
        ...contadoresHeaders,
        Link: `<${CERTAMES_URL}?cursor=p1&direction=prev>; rel="prev"`,
      },
    });
    await cenario.propagar();

    expect(cenario.vitrine().hasPrevious()).toBe(true);
    expect(cenario.vitrine().hasNext()).toBe(false);
    // Página navegada não mostra hero, mesmo sem filtro de busca/situação.
    expect(cenario.vitrine().destaque()).toBeNull();
  });

  it('estado vazio: busca sem resultado orienta a limpar os filtros', async () => {
    await cenario.responderLista([sisu, tecnicoEnfermagem], contadoresHeaders);

    cenario.vitrine().termoBusca.set('curso que não existe');
    await cenario.passarOTempo(ESPERA_DA_BUSCA_MS);
    await cenario.responderLista([], contadoresHeaders);

    const vazio = cenario.host().querySelector('.empty-state');
    expect(vazio?.textContent).toContain('Nenhum certame encontrado');
  });
});
