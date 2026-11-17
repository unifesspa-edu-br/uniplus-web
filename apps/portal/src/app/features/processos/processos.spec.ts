import { SituacaoDoCertame, type CertameNaVitrineDto } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CERTAMES_URL,
  CenarioDaVitrine,
  contadoresHeaders,
  encerrado,
  sisu,
  tecnicoEnfermagem,
} from './processos.testing';
import { VisaoDosCertames } from './visao-dos-certames';

describe('ProcessosComponent', () => {
  let cenario: CenarioDaVitrine;

  beforeEach(() => {
    cenario = new CenarioDaVitrine();
  });

  afterEach(() => cenario.encerrar());

  it('mostra o estado de carregando antes dos dados chegarem', async () => {
    expect(cenario.vitrine().carregando()).toBe(true);
    const indicador = cenario.host().querySelector('.certames-loading');
    expect(indicador?.getAttribute('role')).toBe('status');
    expect(indicador?.textContent).toContain('Carregando certames');
    await cenario.responderLista([], contadoresHeaders);
  });

  it('primeira página pede o vendor MIME certame v1 e o limite padrão', async () => {
    const requisicao = cenario.controller.expectOne(
      (requisicao) => requisicao.url === CERTAMES_URL,
    );
    expect(requisicao.request.headers.get('Accept')).toBe(
      'application/vnd.uniplus.certame.v1+json',
    );
    expect(requisicao.request.params.has('cursor')).toBe(false);
    expect(requisicao.request.params.has('limit')).toBe(true);
    requisicao.flush([sisu, tecnicoEnfermagem], { headers: contadoresHeaders });
    await cenario.propagar();
    expect(cenario.vitrine().certames()).toHaveLength(2);
  });

  it('carrega os certames e anuncia a contagem numa região viva', async () => {
    await cenario.responderLista([sisu, tecnicoEnfermagem], contadoresHeaders);

    expect(cenario.vitrine().carregando()).toBe(false);
    const status = cenario
      .host()
      .querySelector('.certames-count[role="status"][aria-live="polite"]');
    expect(status).toBeTruthy();
    expect(status?.textContent).toContain('2 certames nesta página');
  });

  it('chips de situação usam os contadores dos headers X-Certames-*, não a página carregada', async () => {
    await cenario.responderLista([sisu, tecnicoEnfermagem], contadoresHeaders);
    cenario.fixture.detectChanges();

    expect(cenario.chip('Inscrições abertas')?.textContent).toContain('1');
    expect(cenario.chip('Últimos dias')?.textContent).toContain('1');
    expect(cenario.chip('Em breve')?.textContent).toContain('0');
  });

  it('chip fica sem contador quando a resposta não traz os headers X-Certames-*', async () => {
    await cenario.responderLista([sisu]);
    cenario.fixture.detectChanges();

    expect(cenario.chip('Em breve')?.textContent).not.toContain('0');
    expect(cenario.host().querySelector('.filter-chip__count')).toBeNull();
  });

  it('o hero exibe o primeiro certame da primeira página sem filtro', async () => {
    await cenario.responderLista([sisu, tecnicoEnfermagem], contadoresHeaders);

    expect(cenario.vitrine().destaque()?.nome).toBe(sisu.nome);
    const heroTitle = cenario.host().querySelector('#portal-hero-title');
    expect(heroTitle?.textContent?.trim()).toBe(sisu.nome);
  });

  it('o hero pula os certames que não recebem mais inscrição', async () => {
    await cenario.responderLista([encerrado, sisu], contadoresHeaders);

    expect(cenario.vitrine().destaque()?.nome).toBe(sisu.nome);
  });

  it('sem certame recebendo inscrição, não há hero convidando a se inscrever', async () => {
    await cenario.responderLista([encerrado], contadoresHeaders);

    expect(cenario.vitrine().destaque()).toBeNull();
    expect(cenario.host().querySelector('.portal-hero')).toBeNull();
  });

  it('o h1 da página independe do que a vitrine carregou', async () => {
    await cenario.responderLista([], contadoresHeaders);

    const titulos = Array.from(cenario.host().querySelectorAll('h1'));
    expect(titulos).toHaveLength(1);
    expect(titulos[0].textContent?.trim()).toBe('Processos seletivos');
  });

  it('estado vazio sem filtros: nenhum certame publicado', async () => {
    await cenario.responderLista([], contadoresHeaders);

    const vazio = cenario.host().querySelector('.empty-state');
    expect(vazio?.textContent).toContain('Nenhum certame publicado no momento');
  });

  it('abaixo de 600px o controle de alternância some e a lista é canônica', async () => {
    // A lista do componente criado no cenário continua pendente: as duas requisições
    // (mesma origem) são respondidas juntas.
    const compacta = cenario.criarPaginaEstreita();

    const requests = cenario.controller.match((requisicao) => requisicao.url === CERTAMES_URL);
    expect(requests).toHaveLength(2);
    requests.forEach((requisicao) => requisicao.flush([sisu], { headers: contadoresHeaders }));
    await cenario.propagar();
    compacta.detectChanges();

    const visaoCompacta = compacta.debugElement.injector.get(VisaoDosCertames);
    visaoCompacta.escolher('cards');
    compacta.detectChanges();

    expect(visaoCompacta.visaoEfetiva()).toBe('lista');
    const hostCompacto = compacta.nativeElement as HTMLElement;
    expect(hostCompacto.querySelector('ui-segmented')).toBeNull();
    expect(hostCompacto.querySelector('.certames-list')).toBeTruthy();
    expect(hostCompacto.querySelector('.certames-grid')).toBeNull();
  });

  it('lembra a visão escolhida entre visitas (localStorage)', async () => {
    await cenario.responderLista([sisu], contadoresHeaders);

    cenario.visao().escolher('cards');
    cenario.fixture.detectChanges();

    expect(localStorage.getItem('uniplus.portal.certames-visao')).toBe('cards');
  });

  describe('abertura das inscrições', () => {
    const emBreve = (inscricoesDe: string): CertameNaVitrineDto => ({
      ...sisu,
      inscricoesDe,
      inscricoesAte: '2026-11-13T15:00:00Z',
      situacao: SituacaoDoCertame.emBreve,
    });

    const metaDoPrimeiroItem = (): string =>
      cenario.host().querySelector('.edital-row__meta')?.textContent ?? '';

    it('em data futura mostra "Abre: <data>" e o encerramento, nas duas visões', async () => {
      await cenario.responderLista([emBreve('2026-10-20T11:00:00Z')], contadoresHeaders);
      cenario.fixture.detectChanges();

      expect(metaDoPrimeiroItem()).toContain('Abre: 20 out 2026');
      expect(metaDoPrimeiroItem()).toContain('Encerra: 13 nov 2026');

      cenario.visao().escolher('cards');
      cenario.fixture.detectChanges();
      expect(cenario.host().querySelector('.card .edital-row__meta')?.textContent).toContain(
        'Abre: 20 out 2026',
      );
    });

    it('no próprio dia civil de Belém mostra "hoje às HH:mm"', async () => {
      await cenario.responderLista([emBreve('2026-10-17T19:11:00Z')], contadoresHeaders);
      cenario.fixture.detectChanges();

      expect(metaDoPrimeiroItem()).toContain('Abre: hoje às 16:11');
    });

    it('usa o dia de Belém, não o dia UTC, para decidir o "hoje"', async () => {
      // 02:00Z de 18/10 é 23:00 de 17/10 em Belém: ainda é hoje.
      await cenario.responderLista([emBreve('2026-10-18T02:00:00Z')], contadoresHeaders);
      cenario.fixture.detectChanges();

      expect(metaDoPrimeiroItem()).toContain('Abre: hoje às 23:00');
    });

    it('não mostra abertura que já passou', async () => {
      await cenario.responderLista([emBreve('2026-10-17T11:00:00Z')], contadoresHeaders);
      cenario.fixture.detectChanges();

      expect(metaDoPrimeiroItem()).not.toContain('Abre:');
    });

    it('com inscrições abertas mostra só o encerramento', async () => {
      await cenario.responderLista([sisu], contadoresHeaders);
      cenario.fixture.detectChanges();

      expect(metaDoPrimeiroItem()).toContain('Encerra:');
      expect(metaDoPrimeiroItem()).not.toContain('Abre:');
    });
  });
});
