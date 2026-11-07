import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { RELOGIO } from '@uniplus/shared-core/relogio';
import {
  CertameNaVitrineDto,
  SELECAO_BASE_PATH,
  SituacaoDoCertame,
} from '@uniplus/shared-data/selecao';
import { type Observable, Subject, delay, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnuncioDaConclusao } from '@uniplus/shared-ui/components';

import type { PublicacoesDoCertame } from '../publicacoes/publicacoes.model';
import {
  type CertameParaPublicacoes,
  PublicacoesRepository,
  type PublicacoesPorCertame,
} from '../publicacoes/publicacoes.repository';
import { ProcessosComponent } from './processos';
import { VisaoDosCertames } from './visao-dos-certames';
import { VitrineDeCertames } from './vitrine-de-certames';

const BASE = 'http://localhost:5000';
const CERTAMES_URL = `${BASE}/api/selecao/certames`;
const ACERVO = 'http://localhost:9000/uniplus-acervo-publico';

/** As publicações do próprio certame: o edital de abertura, com o PDF dele no acervo. */
function publicacoesDe(certame: CertameParaPublicacoes): PublicacoesDoCertame {
  const documentoUrl = `${ACERVO}/${certame.processoSeletivoId}.pdf`;
  return {
    documentoEditalUrl: documentoUrl,
    publicacoes: [
      {
        id: `${certame.processoSeletivoId}-abertura`,
        data: '2026-01-05',
        titulo: `Edital de abertura de ${certame.identificadorLegivel}`,
        tipo: 'Edital de abertura',
        documentos: {
          principal: { nome: 'edital.pdf', formato: 'PDF', tamanho: '1,2 MB', url: documentoUrl },
          anexos: [],
        },
      },
    ],
  };
}

/** As publicações chegam depois da vitrine. */
const publicacoesComEdital = {
  buscarPorCertames: (certames: readonly CertameParaPublicacoes[]) =>
    of(
      new Map(certames.map((certame) => [certame.processoSeletivoId, publicacoesDe(certame)])),
    ).pipe(delay(300)),
};

const sisu: CertameNaVitrineDto = {
  processoSeletivoId: '01960000-0000-7000-0000-0000000000e1',
  numero: 'Edital 12/2026',
  nome: 'SISU 2026.1 — Cursos de graduação',
  tipoProcesso: { codigo: 'VESTIBULAR', nome: 'Vestibular' },
  modalidadesOfertadas: ['AC', 'PPI'],
  inscricoesDe: '2026-02-01T00:00:00Z',
  inscricoesAte: '2026-04-16T23:59:59Z',
  situacao: SituacaoDoCertame.inscricoesAbertas,
  totalDeVagas: 1234,
  identificadorLegivel: 'sisu-2026-1',
};

const tecnicoEnfermagem: CertameNaVitrineDto = {
  processoSeletivoId: '01960000-0000-7000-0000-0000000000e2',
  numero: 'Edital 07/2026',
  nome: 'Técnico em Enfermagem',
  tipoProcesso: { codigo: 'PSE', nome: 'Processo Seletivo Especial' },
  modalidadesOfertadas: ['AC'],
  inscricoesDe: '2026-02-01T00:00:00Z',
  inscricoesAte: '2026-03-25T23:59:59Z',
  situacao: SituacaoDoCertame.ultimosDias,
  totalDeVagas: 60,
  identificadorLegivel: 'psr-tec-enfermagem-2026',
};

const encerrado: CertameNaVitrineDto = {
  processoSeletivoId: '01960000-0000-7000-0000-0000000000e3',
  numero: 'Edital 02/2026',
  nome: 'Pós-graduação em Educação',
  tipoProcesso: { codigo: 'PSE', nome: 'Processo Seletivo Especial' },
  modalidadesOfertadas: ['AC'],
  inscricoesDe: '2026-01-05T00:00:00Z',
  inscricoesAte: '2026-03-22T23:59:59Z',
  situacao: SituacaoDoCertame.encerradas,
  totalDeVagas: 40,
  identificadorLegivel: 'pg-educacao-2026',
};

function stubMatchMedia(matches: boolean): void {
  window.matchMedia = ((consulta: string) =>
    ({
      matches,
      media: consulta,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

describe('ProcessosComponent', () => {
  let fixture: ComponentFixture<ProcessosComponent>;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;
  const matchMediaOriginal = window.matchMedia;
  let agora = new Date('2026-10-17T12:00:00Z');

  beforeEach(() => {
    agora = new Date('2026-10-17T12:00:00Z');
    localStorage.clear();
    stubMatchMedia(false);

    TestBed.configureTestingModule({
      imports: [ProcessosComponent],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: PublicacoesRepository, useValue: publicacoesComEdital },
        { provide: RELOGIO, useValue: () => agora },
      ],
    });

    fixture = TestBed.createComponent(ProcessosComponent);
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => {
    window.matchMedia = matchMediaOriginal;
    controller.verify();
  });

  const vitrine = (): VitrineDeCertames => fixture.debugElement.injector.get(VitrineDeCertames);
  const visao = (): VisaoDosCertames => fixture.debugElement.injector.get(VisaoDosCertames);

  const propagate = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
  };

  // Folga acima do debounce da busca (BUSCA_DEBOUNCE_MS = 300 na página).
  const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
  const DEBOUNCE_FOLGA_MS = 360;

  async function flushLista(
    itens: readonly CertameNaVitrineDto[],
    headers?: Record<string, string>,
  ): Promise<void> {
    const req = controller.expectOne((r) => r.url === CERTAMES_URL);
    expect(req.request.params.get('incluir_contadores')).toBe('true');
    req.flush(itens, headers ? { headers } : undefined);
    await propagate();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function chip(rotulo: string): HTMLButtonElement | null {
    return (
      Array.from(host().querySelectorAll<HTMLButtonElement>('.filter-chip')).find((el) =>
        el.textContent?.includes(rotulo),
      ) ?? null
    );
  }

  function botao(rotulo: string): HTMLButtonElement | null {
    return (
      Array.from(host().querySelectorAll<HTMLButtonElement>('button')).find((el) =>
        el.textContent?.includes(rotulo),
      ) ?? null
    );
  }

  const contadoresHeaders = {
    'X-Certames-Em-Breve': '0',
    'X-Certames-Inscricoes-Abertas': '1',
    'X-Certames-Ultimos-Dias': '1',
    'X-Certames-Encerrados': '0',
  };

  it('mostra o estado de carregando antes dos dados chegarem', async () => {
    expect(vitrine().carregando()).toBe(true);
    const indicador = host().querySelector('.certames-loading');
    expect(indicador?.getAttribute('role')).toBe('status');
    expect(indicador?.textContent).toContain('Carregando certames');
    await flushLista([], contadoresHeaders);
  });

  it('primeira página pede o vendor MIME certame v1 e o limite padrão', async () => {
    const req = controller.expectOne((r) => r.url === CERTAMES_URL);
    expect(req.request.headers.get('Accept')).toBe('application/vnd.uniplus.certame.v1+json');
    expect(req.request.params.has('cursor')).toBe(false);
    expect(req.request.params.has('limit')).toBe(true);
    req.flush([sisu, tecnicoEnfermagem], { headers: contadoresHeaders });
    await propagate();
    expect(vitrine().certames()).toHaveLength(2);
  });

  it('carrega os certames e anuncia a contagem numa região viva', async () => {
    await flushLista([sisu, tecnicoEnfermagem], contadoresHeaders);

    expect(vitrine().carregando()).toBe(false);
    const status = host().querySelector('.certames-count[role="status"][aria-live="polite"]');
    expect(status).toBeTruthy();
    expect(status?.textContent).toContain('2 certames nesta página');
  });

  describe('itens sem a seção "Documentos exigidos"', () => {
    const textoDosItens = (seletor: string): string[] =>
      Array.from(host().querySelectorAll(seletor)).map((item) => item.textContent ?? '');

    it('nem a lista nem os cards oferecem a seção em nenhum item', async () => {
      await flushLista([sisu, tecnicoEnfermagem], contadoresHeaders);
      fixture.detectChanges();
      const itensDaLista = textoDosItens('.edital-row');
      expect(itensDaLista).toHaveLength(2);
      itensDaLista.forEach((texto) => expect(texto).not.toContain('Documentos exigidos'));

      visao().escolher('cards');
      fixture.detectChanges();
      const cards = textoDosItens('.certames-grid .card');
      expect(cards).toHaveLength(2);
      cards.forEach((texto) => expect(texto).not.toContain('Documentos exigidos'));
    });

    it('abrir os acionadores dos itens não lê o certame publicado de cada um', async () => {
      const certames = [sisu, tecnicoEnfermagem];
      await flushLista(certames, contadoresHeaders);
      fixture.detectChanges();

      const acionadores = host().querySelectorAll<HTMLButtonElement>('.edital-row button');
      expect(acionadores.length).toBeGreaterThan(0);
      acionadores.forEach((acionador) => acionador.click());
      await propagate();

      certames.forEach((certame) =>
        controller.expectNone(`${CERTAMES_URL}/${certame.processoSeletivoId}`),
      );
    });
  });

  describe('publicações do edital', () => {
    async function carregarComPublicacoes(itens: readonly CertameNaVitrineDto[]): Promise<void> {
      await flushLista(itens, contadoresHeaders);
      await sleep(DEBOUNCE_FOLGA_MS);
      await propagate();
      fixture.detectChanges();
    }

    it('cada item da lista traz o accordion "Ver publicações", fechado', async () => {
      await flushLista([sisu, tecnicoEnfermagem], contadoresHeaders);
      fixture.detectChanges();

      const toggles = host().querySelectorAll<HTMLButtonElement>('.publicacoes-toggle');
      expect(toggles).toHaveLength(2);
      toggles.forEach((toggle) => {
        expect(toggle.textContent).toContain('Ver publicações');
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
      });
    });

    it('a visão em cards também traz o accordion em cada card', async () => {
      await flushLista([sisu, tecnicoEnfermagem], contadoresHeaders);
      visao().escolher('cards');
      fixture.detectChanges();

      expect(host().querySelectorAll('.card .publicacoes-toggle')).toHaveLength(2);
    });

    it('todo certame ganha o link "Ver edital" para o PDF no acervo, só depois que as publicações chegam', async () => {
      await flushLista([sisu, encerrado], contadoresHeaders);
      expect(host().querySelector('.certame-edital-link')).toBeNull();

      await sleep(DEBOUNCE_FOLGA_MS);
      await propagate();
      fixture.detectChanges();

      const links = host().querySelectorAll<HTMLAnchorElement>('.certame-edital-link');
      expect(links).toHaveLength(2);
      expect(links[0].textContent).toContain('Ver edital');
      expect(links[0].getAttribute('href')).toBe(`${ACERVO}/${sisu.processoSeletivoId}.pdf`);
      expect(links[0].target).toBe('_blank');
    });

    it('abrir o accordion mostra a linha do tempo do próprio edital, não a de outro', async () => {
      await carregarComPublicacoes([sisu, tecnicoEnfermagem]);

      host().querySelector<HTMLButtonElement>('.publicacoes-toggle')?.click();
      fixture.detectChanges();

      const linha = host().querySelector('.edital-row');
      expect(linha?.querySelector('.publicacao-timeline')).toBeTruthy();
      expect(linha?.textContent).toContain(`Edital de abertura de ${sisu.identificadorLegivel}`);
      expect(linha?.textContent).not.toContain(tecnicoEnfermagem.identificadorLegivel);
      // O segundo item continua fechado, sem linha do tempo no DOM.
      expect(host().querySelectorAll('.publicacao-timeline')).toHaveLength(1);
    });

    it('o botão de inscrição leva à inscrição no certame', async () => {
      await flushLista([sisu], contadoresHeaders);
      fixture.detectChanges();

      const cta = Array.from(host().querySelectorAll<HTMLAnchorElement>('.edital-row a.btn')).find(
        (a) => a.textContent?.includes('Inscrever-me'),
      );
      expect(cta?.getAttribute('href')).toBe(`/inscricao/${sisu.processoSeletivoId}`);
      expect(cta?.textContent).toContain(sisu.nome);
    });

    it('o certame que não recebe mais inscrição não oferece o botão', async () => {
      await flushLista([encerrado], contadoresHeaders);
      fixture.detectChanges();

      expect(host().querySelector('.edital-row')?.textContent).not.toContain('Inscrever-me');
    });
  });

  it('chips de situação usam os contadores dos headers X-Certames-*, não a página carregada', async () => {
    await flushLista([sisu, tecnicoEnfermagem], contadoresHeaders);
    fixture.detectChanges();

    expect(chip('Inscrições abertas')?.textContent).toContain('1');
    expect(chip('Últimos dias')?.textContent).toContain('1');
    expect(chip('Em breve')?.textContent).toContain('0');
  });

  it('o hero exibe o primeiro certame da primeira página sem filtro', async () => {
    await flushLista([sisu, tecnicoEnfermagem], contadoresHeaders);

    expect(vitrine().destaque()?.nome).toBe(sisu.nome);
    const heroTitle = host().querySelector('#portal-hero-title');
    expect(heroTitle?.textContent?.trim()).toBe(sisu.nome);
  });

  it('o hero pula os certames que não recebem mais inscrição', async () => {
    await flushLista([encerrado, sisu], contadoresHeaders);

    expect(vitrine().destaque()?.nome).toBe(sisu.nome);
  });

  it('sem certame recebendo inscrição, não há hero convidando a se inscrever', async () => {
    await flushLista([encerrado], contadoresHeaders);

    expect(vitrine().destaque()).toBeNull();
    expect(host().querySelector('.portal-hero')).toBeNull();
  });

  it('o h1 da página independe do que a vitrine carregou', async () => {
    await flushLista([], contadoresHeaders);

    const titulos = Array.from(host().querySelectorAll('h1'));
    expect(titulos).toHaveLength(1);
    expect(titulos[0].textContent?.trim()).toBe('Processos seletivos');
  });

  it('chip fica sem contador quando a resposta não traz os headers X-Certames-*', async () => {
    await flushLista([sisu]);
    fixture.detectChanges();

    expect(chip('Em breve')?.textContent).not.toContain('0');
    expect(host().querySelector('.filter-chip__count')).toBeNull();
  });

  it('busca server-side: digitação em rajada dispara um único GET com q após o debounce, na primeira página', async () => {
    await flushLista([sisu, tecnicoEnfermagem], contadoresHeaders);

    vitrine().termoBusca.set('t');
    vitrine().termoBusca.set('te');
    vitrine().termoBusca.set('tecnico');
    appRef.tick();
    controller.expectNone((r) => r.url === CERTAMES_URL && r.params.has('q'));

    await sleep(DEBOUNCE_FOLGA_MS);
    await propagate();

    const req = controller.expectOne((r) => r.url === CERTAMES_URL && r.params.has('q'));
    expect(req.request.params.get('q')).toBe('tecnico');
    expect(req.request.params.has('cursor')).toBe(false);
    req.flush([tecnicoEnfermagem], { headers: contadoresHeaders });
    await propagate();
    expect(vitrine().certames()).toHaveLength(1);
    // Sem hero enquanto há busca ativa.
    expect(vitrine().destaque()).toBeNull();
  });

  it('filtro por situação dispara GET com situacao e reseta a paginação', async () => {
    await flushLista([sisu, tecnicoEnfermagem], contadoresHeaders);

    chip('Últimos dias')?.click();
    fixture.detectChanges();

    const req = controller.expectOne((r) => r.url === CERTAMES_URL && r.params.has('situacao'));
    expect(req.request.params.get('situacao')).toBe(SituacaoDoCertame.ultimosDias);
    expect(req.request.params.has('cursor')).toBe(false);
    req.flush([tecnicoEnfermagem], { headers: contadoresHeaders });
    await propagate();
    expect(vitrine().certames()).toEqual([tecnicoEnfermagem]);
  });

  it('"Limpar filtros" reseta busca e situação, refazendo a request sem elas', async () => {
    await flushLista([sisu, tecnicoEnfermagem], contadoresHeaders);

    vitrine().termoBusca.set('tecnico');
    await sleep(DEBOUNCE_FOLGA_MS);
    await propagate();
    await flushLista([tecnicoEnfermagem], contadoresHeaders);

    expect(vitrine().temFiltrosAtivos()).toBe(true);
    botao('Limpar filtros')?.click();
    fixture.detectChanges();
    // `termoBusca` limpo também passa pelo debounce antes de virar `buscaAplicada`.
    await sleep(DEBOUNCE_FOLGA_MS);
    await propagate();

    const req = controller.expectOne((r) => r.url === CERTAMES_URL);
    expect(req.request.params.has('q')).toBe(false);
    expect(req.request.params.has('situacao')).toBe(false);
    req.flush([sisu, tecnicoEnfermagem], { headers: contadoresHeaders });
    await propagate();
    expect(vitrine().temFiltrosAtivos()).toBe(false);
  });

  it('pagina os resultados: Próximo segue o cursor do Link e Anterior volta', async () => {
    await flushLista([sisu], {
      ...contadoresHeaders,
      Link: `<${CERTAMES_URL}?cursor=p2&direction=next>; rel="next"`,
    });

    expect(vitrine().hasPrevious()).toBe(false);
    expect(vitrine().hasNext()).toBe(true);

    vitrine().proximaPagina();
    await propagate();

    const req = controller.expectOne((r) => r.url === CERTAMES_URL);
    expect(req.request.params.get('cursor')).toBe('p2');
    expect(req.request.params.get('direction')).toBe('next');
    req.flush([tecnicoEnfermagem], {
      headers: {
        ...contadoresHeaders,
        Link: `<${CERTAMES_URL}?cursor=p1&direction=prev>; rel="prev"`,
      },
    });
    await propagate();

    expect(vitrine().hasPrevious()).toBe(true);
    expect(vitrine().hasNext()).toBe(false);
    // Página navegada não mostra hero, mesmo sem filtro de busca/situação.
    expect(vitrine().destaque()).toBeNull();
  });

  it('estado vazio: busca sem resultado orienta a limpar os filtros', async () => {
    await flushLista([sisu, tecnicoEnfermagem], contadoresHeaders);

    vitrine().termoBusca.set('curso que não existe');
    await sleep(DEBOUNCE_FOLGA_MS);
    await propagate();
    await flushLista([], contadoresHeaders);

    const vazio = host().querySelector('.empty-state');
    expect(vazio?.textContent).toContain('Nenhum certame encontrado');
  });

  it('estado vazio sem filtros: nenhum certame publicado', async () => {
    await flushLista([], contadoresHeaders);

    const vazio = host().querySelector('.empty-state');
    expect(vazio?.textContent).toContain('Nenhum certame publicado no momento');
  });

  it('estado de erro (500) mostra mensagem e ação de tentar novamente', async () => {
    const req = controller.expectOne((r) => r.url === CERTAMES_URL);
    req.flush(
      JSON.stringify({
        type: 'https://uniplus.dev/erros/uniplus.infra.erro_interno',
        title: 'Erro interno ao consultar certames',
        status: 500,
        code: 'uniplus.infra.erro_interno',
        traceId: 'test-trace',
      }),
      {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();
    fixture.detectChanges();

    const alerta = host().querySelector('.alert--danger');
    expect(alerta?.textContent).toContain('Erro interno ao consultar certames');
    // Busca e chips continuam de pé: quando é o recorte que a API recusa,
    // desfazê-lo é a saída.
    expect(host().querySelector('ui-filter-bar')).toBeTruthy();
    expect(chip('Últimos dias')).toBeTruthy();

    const tentar = botao('Tentar novamente');
    expect(tentar).toBeTruthy();
    tentar?.click();
    await propagate();

    controller
      .expectOne((r) => r.url === CERTAMES_URL)
      .flush([sisu], { headers: contadoresHeaders });
    await propagate();
    expect(vitrine().erro()).toBeNull();
  });

  it('"Limpar filtros" sem filtro aplicado não apaga o texto que ainda espera o debounce', async () => {
    await flushLista([sisu], contadoresHeaders);
    vitrine().termoBusca.set('tecn');
    fixture.detectChanges();

    botao('Limpar filtros')?.click();

    expect(vitrine().termoBusca()).toBe('tecn');
    await sleep(DEBOUNCE_FOLGA_MS);
    await propagate();
    controller
      .expectOne((r) => r.url === CERTAMES_URL && r.params.get('q') === 'tecn')
      .flush([sisu]);
    await propagate();
  });

  it('"Limpar filtros" acionado mantém o foco no botão, que passa a indisponível sem sair da ordem de tab', async () => {
    await flushLista([sisu, tecnicoEnfermagem], contadoresHeaders);
    vitrine().termoBusca.set('tecnico');
    await sleep(DEBOUNCE_FOLGA_MS);
    await propagate();
    await flushLista([tecnicoEnfermagem], contadoresHeaders);
    const limpar = botao('Limpar filtros');
    limpar?.focus();

    limpar?.click();
    await sleep(DEBOUNCE_FOLGA_MS);
    await propagate();
    fixture.detectChanges();

    expect(document.activeElement).toBe(limpar);
    expect(limpar?.getAttribute('aria-disabled')).toBe('true');
    expect(limpar?.disabled).toBe(false);
    controller
      .expectOne((r) => r.url === CERTAMES_URL)
      .flush([sisu], { headers: contadoresHeaders });
    await propagate();
  });

  it('"Tentar novamente" com a consulta em curso mantém o foco e não parte outra requisição', async () => {
    await flushLista([sisu], contadoresHeaders);
    vitrine().situacaoSelecionada.set('INSCRICOES_ABERTAS');
    await propagate();
    controller
      .expectOne((r) => r.url === CERTAMES_URL)
      .flush(JSON.stringify({ title: 'Erro', status: 500, code: 'uniplus.infra.erro_interno' }), {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'content-type': 'application/problem+json' },
      });
    await propagate();
    fixture.detectChanges();
    const tentar = botao('Tentar novamente');
    tentar?.focus();

    tentar?.click();
    await propagate();
    tentar?.click();
    await propagate();

    expect(document.activeElement).toBe(tentar);
    expect(tentar?.getAttribute('aria-disabled')).toBe('true');
    expect(tentar?.getAttribute('aria-busy')).toBe('true');
    controller
      .expectOne((r) => r.url === CERTAMES_URL)
      .flush([sisu], { headers: contadoresHeaders });
    await propagate();
  });

  it('"Tentar novamente" que dá certo leva o foco ao título, sem tê-lo movido ao clicar', async () => {
    await flushLista([sisu], contadoresHeaders);
    vitrine().situacaoSelecionada.set('INSCRICOES_ABERTAS');
    await propagate();
    controller
      .expectOne((r) => r.url === CERTAMES_URL)
      .flush(JSON.stringify({ title: 'Erro', status: 500, code: 'uniplus.infra.erro_interno' }), {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'content-type': 'application/problem+json' },
      });
    await propagate();
    fixture.detectChanges();
    const titulo = host().querySelector('h1');
    const tentar = botao('Tentar novamente');
    tentar?.focus();

    tentar?.click();
    await propagate();
    fixture.detectChanges();
    expect(document.activeElement).toBe(tentar);
    expect(host().querySelector('ui-situacao-da-nova-tentativa')?.textContent).toBe(
      'Tentando novamente…',
    );

    controller
      .expectOne((r) => r.url === CERTAMES_URL)
      .flush([sisu], { headers: contadoresHeaders });
    await propagate();
    await sleep(0);
    await propagate();
    fixture.detectChanges();

    expect(document.activeElement).toBe(titulo);
  });

  it('"Tentar novamente" repete a página em que o erro aconteceu, sem voltar à primeira', async () => {
    await flushLista([sisu], {
      ...contadoresHeaders,
      Link: `<${CERTAMES_URL}?cursor=p2&direction=next>; rel="next"`,
    });

    vitrine().proximaPagina();
    await propagate();
    controller
      .expectOne((r) => r.url === CERTAMES_URL)
      .flush(
        JSON.stringify({
          type: 'https://uniplus.dev/erros/uniplus.infra.erro_interno',
          title: 'Erro interno ao consultar certames',
          status: 500,
          code: 'uniplus.infra.erro_interno',
          traceId: 'test-trace',
        }),
        {
          status: 500,
          statusText: 'Internal Server Error',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
    await propagate();
    fixture.detectChanges();

    botao('Tentar novamente')?.click();
    await propagate();

    const repetida = controller.expectOne((r) => r.url === CERTAMES_URL);
    expect(repetida.request.params.get('cursor')).toBe('p2');
    expect(repetida.request.params.get('direction')).toBe('next');
    repetida.flush([tecnicoEnfermagem], { headers: contadoresHeaders });
    await propagate();
    expect(vitrine().erro()).toBeNull();
  });

  it('cursor expirado (410) numa página navegada recarrega do início em silêncio', async () => {
    await flushLista([sisu], {
      ...contadoresHeaders,
      Link: `<${CERTAMES_URL}?cursor=p2&direction=next>; rel="next"`,
    });

    vitrine().proximaPagina();
    await propagate();
    controller
      .expectOne((r) => r.url === CERTAMES_URL)
      .flush(
        JSON.stringify({
          type: 'https://uniplus.dev/erros/uniplus.cursor.expirado',
          title: 'Cursor de paginação expirado',
          status: 410,
          code: 'uniplus.cursor.expirado',
          traceId: 'test-trace',
        }),
        {
          status: 410,
          statusText: 'Gone',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
    await propagate();

    const recarga = controller.expectOne((r) => r.url === CERTAMES_URL);
    expect(recarga.request.params.has('cursor')).toBe(false);
    recarga.flush([sisu], { headers: contadoresHeaders });
    await propagate();
    expect(vitrine().erro()).toBeNull();
  });

  it('"Tentar novamente" que recebe cursor expirado (410) segue "tentando" até a recarga do início e só então devolve o foco', async () => {
    const problema = (status: number, code: string): [string, object] => [
      JSON.stringify({ title: 'Erro', status, code, traceId: 'test-trace' }),
      { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
    ];
    await flushLista([sisu], {
      ...contadoresHeaders,
      Link: `<${CERTAMES_URL}?cursor=p2&direction=next>; rel="next"`,
    });
    vitrine().proximaPagina();
    await propagate();
    const [corpo500, opcoes500] = problema(500, 'uniplus.infra.erro_interno');
    controller.expectOne((r) => r.url === CERTAMES_URL).flush(corpo500, opcoes500);
    await propagate();
    fixture.detectChanges();
    const tentar = botao('Tentar novamente');
    tentar?.focus();
    const anunciar = vi.spyOn(TestBed.inject(AnuncioDaConclusao), 'anunciar');

    tentar?.click();
    await propagate();
    const [corpo410, opcoes410] = problema(410, 'uniplus.cursor.expirado');
    controller.expectOne((r) => r.url === CERTAMES_URL).flush(corpo410, opcoes410);
    await propagate();
    await sleep(0);
    await propagate();
    fixture.detectChanges();

    const recarga = controller.expectOne((r) => r.url === CERTAMES_URL);
    expect(host().querySelector('ui-situacao-da-nova-tentativa')?.textContent).toBe(
      'Tentando novamente…',
    );
    expect(document.activeElement).toBe(tentar);
    expect(anunciar).not.toHaveBeenCalled();

    recarga.flush([sisu], { headers: contadoresHeaders });
    await propagate();
    await sleep(0);
    await propagate();
    fixture.detectChanges();

    expect(document.activeElement).toBe(host().querySelector('h1'));
    expect(anunciar).not.toHaveBeenCalled();
  });

  it('abaixo de 600px o controle de alternância some e a lista é canônica', async () => {
    // Sem `flushLista` do componente do `beforeEach`: essa 1ª request some do
    // controller ao criar o 2º componente por engano (mesma origem), então
    // resolve as duas requests pendentes ao final.
    stubMatchMedia(true);
    const fixtureCompacto = TestBed.createComponent(ProcessosComponent);
    fixtureCompacto.detectChanges();

    const requests = controller.match((r) => r.url === CERTAMES_URL);
    expect(requests).toHaveLength(2);
    requests.forEach((req) => req.flush([sisu], { headers: contadoresHeaders }));
    await propagate();
    fixtureCompacto.detectChanges();

    fixtureCompacto.debugElement.injector.get(VisaoDosCertames).escolher('cards');
    fixtureCompacto.detectChanges();

    expect(fixtureCompacto.debugElement.injector.get(VisaoDosCertames).visaoEfetiva()).toBe(
      'lista',
    );
    const hostCompacto = fixtureCompacto.nativeElement as HTMLElement;
    expect(hostCompacto.querySelector('ui-segmented')).toBeNull();
    expect(hostCompacto.querySelector('.certames-list')).toBeTruthy();
    expect(hostCompacto.querySelector('.certames-grid')).toBeNull();
  });

  it('lembra a visão escolhida entre visitas (localStorage)', async () => {
    await flushLista([sisu], contadoresHeaders);

    visao().escolher('cards');
    fixture.detectChanges();

    expect(localStorage.getItem('uniplus.portal.certames-visao')).toBe('cards');
  });

  describe('abertura das inscrições', () => {
    const emBreve = (inscricoesDe: string): CertameNaVitrineDto => ({
      ...sisu,
      inscricoesDe,
      inscricoesAte: '2026-11-13T15:00:00Z',
      situacao: SituacaoDoCertame.emBreve,
    });

    it('em data futura mostra "Abre: <data>" e o encerramento, nas duas visões', async () => {
      await flushLista([emBreve('2026-10-20T11:00:00Z')], contadoresHeaders);
      fixture.detectChanges();

      const lista = host().querySelector('.edital-row__meta')?.textContent ?? '';
      expect(lista).toContain('Abre: 20 out 2026');
      expect(lista).toContain('Encerra: 13 nov 2026');

      visao().escolher('cards');
      fixture.detectChanges();
      expect(host().querySelector('.card .edital-row__meta')?.textContent).toContain(
        'Abre: 20 out 2026',
      );
    });

    it('no próprio dia civil de Belém mostra "hoje às HH:mm"', async () => {
      await flushLista([emBreve('2026-10-17T19:11:00Z')], contadoresHeaders);
      fixture.detectChanges();

      expect(host().querySelector('.edital-row__meta')?.textContent).toContain(
        'Abre: hoje às 16:11',
      );
    });

    it('usa o dia de Belém, não o dia UTC, para decidir o "hoje"', async () => {
      // 02:00Z de 18/10 é 23:00 de 17/10 em Belém: ainda é hoje.
      await flushLista([emBreve('2026-10-18T02:00:00Z')], contadoresHeaders);
      fixture.detectChanges();

      expect(host().querySelector('.edital-row__meta')?.textContent).toContain(
        'Abre: hoje às 23:00',
      );
    });

    it('não mostra abertura que já passou', async () => {
      await flushLista([emBreve('2026-10-17T11:00:00Z')], contadoresHeaders);
      fixture.detectChanges();

      expect(host().querySelector('.edital-row__meta')?.textContent).not.toContain('Abre:');
    });

    it('com inscrições abertas mostra só o encerramento', async () => {
      await flushLista([sisu], contadoresHeaders);
      fixture.detectChanges();

      const meta = host().querySelector('.edital-row__meta')?.textContent ?? '';
      expect(meta).toContain('Encerra:');
      expect(meta).not.toContain('Abre:');
    });
  });
});

describe('ProcessosComponent — sem documento de edital de abertura (CA-14)', () => {
  const semDocumento: CertameNaVitrineDto = {
    processoSeletivoId: '01960000-0000-7000-0000-0000000000e9',
    identificadorLegivel: 'ps-sem-documento',
    numero: 'Edital 99/2026',
    nome: 'Certame sem PDF do edital',
    tipoProcesso: { codigo: 'VESTIBULAR', nome: 'Vestibular' },
    modalidadesOfertadas: ['AC'],
    inscricoesDe: '2026-02-01T00:00:00Z',
    inscricoesAte: '2026-04-16T23:59:59Z',
    situacao: SituacaoDoCertame.inscricoesAbertas,
    totalDeVagas: 10,
  };

  // Ato sem PDF e sem edital vigente no acervo: não há o que abrir.
  const publicacaoSemDocumento: PublicacoesDoCertame = {
    publicacoes: [
      {
        id: 'ato-abertura',
        data: '2026-01-05',
        titulo: 'Edital de abertura',
        tipo: 'Edital de abertura',
        documentos: { anexos: [] },
      },
    ],
  };

  it('não mostra o link "Ver edital" quando a publicação não tem documento de abertura', async () => {
    window.matchMedia = ((consulta: string) =>
      ({
        matches: false,
        media: consulta,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;

    TestBed.configureTestingModule({
      imports: [ProcessosComponent],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        {
          provide: PublicacoesRepository,
          useValue: {
            buscarPorCertames: () =>
              of(new Map([[semDocumento.processoSeletivoId, publicacaoSemDocumento]])),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(ProcessosComponent);
    const controller = TestBed.inject(HttpTestingController);
    const appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();

    controller.expectOne((r) => r.url === CERTAMES_URL).flush([semDocumento]);
    await Promise.resolve();
    appRef.tick();
    await new Promise((resolve) => setTimeout(resolve, 360));
    await Promise.resolve();
    appRef.tick();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.publicacoes-toggle')).toBeTruthy();
    expect(host.querySelector('.certame-edital-link')).toBeNull();

    controller.verify();
  });

  it('o certame cuja consulta das publicações falhou mostra o erro no accordion, sem "Ver edital"', async () => {
    window.matchMedia = ((consulta: string) =>
      ({
        matches: false,
        media: consulta,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;

    TestBed.configureTestingModule({
      imports: [ProcessosComponent],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        {
          provide: PublicacoesRepository,
          useValue: {
            buscarPorCertames: () => of(new Map([[semDocumento.processoSeletivoId, null]])),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(ProcessosComponent);
    const controller = TestBed.inject(HttpTestingController);
    const appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();

    controller.expectOne((r) => r.url === CERTAMES_URL).flush([semDocumento]);
    await Promise.resolve();
    appRef.tick();
    await new Promise((resolve) => setTimeout(resolve, 360));
    await Promise.resolve();
    appRef.tick();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('.publicacoes-toggle')?.click();
    fixture.detectChanges();

    expect(host.querySelector('.alert--danger')?.textContent).toContain(
      'Não foi possível carregar as publicações',
    );
    expect(host.querySelector('.certame-edital-link')).toBeNull();

    controller.verify();
  });
  it('"Tentar novamente" nas publicações lê de novo e mostra a linha do tempo do certame', async () => {
    const retorno = new Subject<Map<string, PublicacoesDoCertame | null>>();
    const falhou = new Map([[semDocumento.processoSeletivoId, null]]);
    // A primeira leitura é a da vitrine ainda vazia; as seguintes, a do certame e a nova tentativa.
    const buscar = vi
      .fn<(certames: readonly CertameParaPublicacoes[]) => Observable<PublicacoesPorCertame>>()
      .mockReturnValueOnce(of(new Map()))
      .mockReturnValueOnce(of(falhou))
      .mockReturnValueOnce(retorno);
    TestBed.configureTestingModule({
      imports: [ProcessosComponent],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: PublicacoesRepository, useValue: { buscarPorCertames: buscar } },
      ],
    });
    const fixture = TestBed.createComponent(ProcessosComponent);
    const controller = TestBed.inject(HttpTestingController);
    const appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
    controller.expectOne((r) => r.url === CERTAMES_URL).flush([semDocumento]);
    await Promise.resolve();
    appRef.tick();
    await new Promise((resolve) => setTimeout(resolve, 360));
    await Promise.resolve();
    appRef.tick();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('.publicacoes-toggle')?.click();
    fixture.detectChanges();

    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((el) => el.textContent?.trim() === 'Tentar novamente')
      ?.click();
    await Promise.resolve();
    appRef.tick();
    fixture.detectChanges();

    expect(buscar).toHaveBeenCalledTimes(3);
    expect(host.querySelector('.publicacoes-loading')).not.toBeNull();
    expect(host.querySelector('ui-situacao-da-nova-tentativa')?.textContent).toBe(
      'Tentando novamente…',
    );

    retorno.next(new Map([[semDocumento.processoSeletivoId, publicacoesDe(semDocumento)]]));
    await Promise.resolve();
    appRef.tick();
    fixture.detectChanges();

    expect(host.querySelector('.publicacao-timeline')).not.toBeNull();
    expect(host.querySelector('.certame-edital-link')).not.toBeNull();

    controller.verify();
  });
  it('a nova tentativa de um certame não tira a linha do tempo nem o edital de outro já carregado', async () => {
    const retorno = new Subject<Map<string, PublicacoesDoCertame | null>>();
    const buscar = vi
      .fn<(certames: readonly CertameParaPublicacoes[]) => Observable<PublicacoesPorCertame>>()
      .mockReturnValueOnce(of(new Map()))
      .mockImplementationOnce((certames) =>
        of(
          new Map(
            certames.map((c) => [
              c.processoSeletivoId,
              c.processoSeletivoId === sisu.processoSeletivoId ? null : publicacoesDe(c),
            ]),
          ),
        ),
      )
      .mockReturnValueOnce(retorno);
    TestBed.configureTestingModule({
      imports: [ProcessosComponent],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: PublicacoesRepository, useValue: { buscarPorCertames: buscar } },
      ],
    });
    const fixture = TestBed.createComponent(ProcessosComponent);
    const controller = TestBed.inject(HttpTestingController);
    const appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
    controller.expectOne((r) => r.url === CERTAMES_URL).flush([sisu, tecnicoEnfermagem]);
    await Promise.resolve();
    appRef.tick();
    await new Promise((resolve) => setTimeout(resolve, 360));
    await Promise.resolve();
    appRef.tick();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    host.querySelectorAll<HTMLButtonElement>('.publicacoes-toggle').forEach((b) => b.click());
    fixture.detectChanges();
    const linksAntes = host.querySelectorAll('.certame-edital-link').length;

    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((el) => el.textContent?.trim() === 'Tentar novamente')
      ?.click();
    await Promise.resolve();
    appRef.tick();
    fixture.detectChanges();

    expect(buscar.mock.calls.at(-1)?.[0].map((c) => c.processoSeletivoId)).toEqual([
      sisu.processoSeletivoId,
    ]);
    expect(host.querySelectorAll('.publicacoes-loading')).toHaveLength(1);
    expect(host.querySelectorAll('.certame-edital-link')).toHaveLength(linksAntes);
    expect(linksAntes).toBeGreaterThan(0);

    controller.verify();
  });
});
