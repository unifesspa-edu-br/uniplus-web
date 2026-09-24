import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CertameNaVitrineDto,
  SELECAO_BASE_PATH,
  SituacaoDoCertame,
} from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessosComponent } from './processos';

const BASE = 'http://localhost:5000';
const CERTAMES_URL = `${BASE}/api/selecao/certames`;

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
  let component: ProcessosComponent;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;
  const matchMediaOriginal = window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    stubMatchMedia(false);

    TestBed.configureTestingModule({
      imports: [ProcessosComponent],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });

    fixture = TestBed.createComponent(ProcessosComponent);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => {
    window.matchMedia = matchMediaOriginal;
    controller.verify();
  });

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
    expect(component['carregando']()).toBe(true);
    const status = host().querySelector('.certames-count[role="status"]');
    expect(status?.textContent).toContain('Carregando');
    await flushLista([], contadoresHeaders);
  });

  it('primeira página pede o vendor MIME certame v1 e o limite padrão', async () => {
    const req = controller.expectOne((r) => r.url === CERTAMES_URL);
    expect(req.request.headers.get('Accept')).toBe('application/vnd.uniplus.certame.v1+json');
    expect(req.request.params.has('cursor')).toBe(false);
    expect(req.request.params.has('limit')).toBe(true);
    req.flush([sisu, tecnicoEnfermagem], { headers: contadoresHeaders });
    await propagate();
    expect(component['certames']()).toHaveLength(2);
  });

  it('carrega os certames e anuncia a contagem numa região viva', async () => {
    await flushLista([sisu, tecnicoEnfermagem], contadoresHeaders);

    expect(component['carregando']()).toBe(false);
    const status = host().querySelector('.certames-count[role="status"][aria-live="polite"]');
    expect(status).toBeTruthy();
    expect(status?.textContent).toContain('2 certames nesta página');
  });

  describe('publicações do edital', () => {
    // As publicações são simuladas para todo certame, a partir dos dados dele.
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
      component['setVisao']('cards');
      fixture.detectChanges();

      expect(host().querySelectorAll('.card .publicacoes-toggle')).toHaveLength(2);
    });

    it('todo certame ganha o link "Ler o edital de abertura", só depois que as publicações chegam', async () => {
      await flushLista([sisu, encerrado], contadoresHeaders);
      expect(host().querySelector('.certame-edital-link')).toBeNull();

      await sleep(DEBOUNCE_FOLGA_MS);
      await propagate();
      fixture.detectChanges();

      const links = host().querySelectorAll<HTMLAnchorElement>('.certame-edital-link');
      expect(links).toHaveLength(2);
      expect(links[0].textContent).toContain('Ler o edital de abertura');
      expect(links[0].getAttribute('href')).toBe(
        `/publicacoes/${sisu.processoSeletivoId}/eventos/${sisu.processoSeletivoId}-edital/documento`,
      );
      expect(links[0].target).toBe('_blank');
    });

    it('abrir o accordion mostra a linha do tempo do próprio edital, não a de outro', async () => {
      await carregarComPublicacoes([sisu, tecnicoEnfermagem]);

      host().querySelector<HTMLButtonElement>('.publicacoes-toggle')?.click();
      fixture.detectChanges();

      const linha = host().querySelector('.edital-row');
      expect(linha?.querySelector('.publicacao-timeline')).toBeTruthy();
      expect(linha?.textContent).toContain('Edital publicado');
      expect(linha?.textContent).toContain('Inscrições abertas');
      // O segundo item continua fechado, sem linha do tempo no DOM.
      expect(host().querySelectorAll('.publicacao-timeline')).toHaveLength(1);
    });

    it('o botão de inscrição convida a entrar e se inscrever', async () => {
      await flushLista([sisu], contadoresHeaders);
      fixture.detectChanges();

      const cta = Array.from(host().querySelectorAll<HTMLAnchorElement>('.edital-row a.btn')).find(
        (a) => a.textContent?.includes('Entre e inscreva-se'),
      );
      expect(cta?.getAttribute('href')).toBe('/inscricao');
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

    expect(component['destaque']()?.nome).toBe(sisu.nome);
    const heroTitle = host().querySelector('#portal-hero-title');
    expect(heroTitle?.textContent?.trim()).toBe(sisu.nome);
  });

  it('o hero pula os certames que não recebem mais inscrição', async () => {
    await flushLista([encerrado, sisu], contadoresHeaders);

    expect(component['destaque']()?.nome).toBe(sisu.nome);
  });

  it('sem certame recebendo inscrição, não há hero convidando a se inscrever', async () => {
    await flushLista([encerrado], contadoresHeaders);

    expect(component['destaque']()).toBeNull();
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

    component['termoBusca'].set('t');
    component['termoBusca'].set('te');
    component['termoBusca'].set('tecnico');
    appRef.tick();
    controller.expectNone((r) => r.url === CERTAMES_URL && r.params.has('q'));

    await sleep(DEBOUNCE_FOLGA_MS);
    await propagate();

    const req = controller.expectOne((r) => r.url === CERTAMES_URL && r.params.has('q'));
    expect(req.request.params.get('q')).toBe('tecnico');
    expect(req.request.params.has('cursor')).toBe(false);
    req.flush([tecnicoEnfermagem], { headers: contadoresHeaders });
    await propagate();
    expect(component['certames']()).toHaveLength(1);
    // Sem hero enquanto há busca ativa.
    expect(component['destaque']()).toBeNull();
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
    expect(component['certames']()).toEqual([tecnicoEnfermagem]);
  });

  it('"Limpar filtros" reseta busca e situação, refazendo a request sem elas', async () => {
    await flushLista([sisu, tecnicoEnfermagem], contadoresHeaders);

    component['termoBusca'].set('tecnico');
    await sleep(DEBOUNCE_FOLGA_MS);
    await propagate();
    await flushLista([tecnicoEnfermagem], contadoresHeaders);

    expect(component['temFiltrosAtivos']()).toBe(true);
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
    expect(component['temFiltrosAtivos']()).toBe(false);
  });

  it('pagina os resultados: Próximo segue o cursor do Link e Anterior volta', async () => {
    await flushLista([sisu], {
      ...contadoresHeaders,
      Link: `<${CERTAMES_URL}?cursor=p2&direction=next>; rel="next"`,
    });

    expect(component['hasPrevious']()).toBe(false);
    expect(component['hasNext']()).toBe(true);

    component['proximaPagina']();
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

    expect(component['hasPrevious']()).toBe(true);
    expect(component['hasNext']()).toBe(false);
    // Página navegada não mostra hero, mesmo sem filtro de busca/situação.
    expect(component['destaque']()).toBeNull();
  });

  it('estado vazio: busca sem resultado orienta a limpar os filtros', async () => {
    await flushLista([sisu, tecnicoEnfermagem], contadoresHeaders);

    component['termoBusca'].set('curso que não existe');
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
      { status: 500, statusText: 'Internal Server Error', headers: { 'content-type': 'application/problem+json' } },
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

    controller.expectOne((r) => r.url === CERTAMES_URL).flush([sisu], { headers: contadoresHeaders });
    await propagate();
    expect(component['erro']()).toBeNull();
  });

  it('"Tentar novamente" repete a página em que o erro aconteceu, sem voltar à primeira', async () => {
    await flushLista([sisu], {
      ...contadoresHeaders,
      Link: `<${CERTAMES_URL}?cursor=p2&direction=next>; rel="next"`,
    });

    component['proximaPagina']();
    await propagate();
    controller.expectOne((r) => r.url === CERTAMES_URL).flush(
      JSON.stringify({
        type: 'https://uniplus.dev/erros/uniplus.infra.erro_interno',
        title: 'Erro interno ao consultar certames',
        status: 500,
        code: 'uniplus.infra.erro_interno',
        traceId: 'test-trace',
      }),
      { status: 500, statusText: 'Internal Server Error', headers: { 'content-type': 'application/problem+json' } },
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
    expect(component['erro']()).toBeNull();
  });

  it('cursor expirado (410) numa página navegada recarrega do início em silêncio', async () => {
    await flushLista([sisu], {
      ...contadoresHeaders,
      Link: `<${CERTAMES_URL}?cursor=p2&direction=next>; rel="next"`,
    });

    component['proximaPagina']();
    await propagate();
    controller.expectOne((r) => r.url === CERTAMES_URL).flush(
      JSON.stringify({
        type: 'https://uniplus.dev/erros/uniplus.cursor.expirado',
        title: 'Cursor de paginação expirado',
        status: 410,
        code: 'uniplus.cursor.expirado',
        traceId: 'test-trace',
      }),
      { status: 410, statusText: 'Gone', headers: { 'content-type': 'application/problem+json' } },
    );
    await propagate();

    const recarga = controller.expectOne((r) => r.url === CERTAMES_URL);
    expect(recarga.request.params.has('cursor')).toBe(false);
    recarga.flush([sisu], { headers: contadoresHeaders });
    await propagate();
    expect(component['erro']()).toBeNull();
  });

  it('abaixo de 600px o controle de alternância some e a lista é canônica', async () => {
    // Sem `flushLista` do componente do `beforeEach`: essa 1ª request some do
    // controller ao criar o 2º componente por engano (mesma origem), então
    // resolve as duas requests pendentes ao final.
    stubMatchMedia(true);
    const fixtureCompacto = TestBed.createComponent(ProcessosComponent);
    const componenteCompacto = fixtureCompacto.componentInstance;
    fixtureCompacto.detectChanges();

    const requests = controller.match((r) => r.url === CERTAMES_URL);
    expect(requests).toHaveLength(2);
    requests.forEach((req) => req.flush([sisu], { headers: contadoresHeaders }));
    await propagate();
    fixtureCompacto.detectChanges();

    componenteCompacto['visao'].set('cards');
    fixtureCompacto.detectChanges();

    expect(componenteCompacto['visaoEfetiva']()).toBe('lista');
    const hostCompacto = fixtureCompacto.nativeElement as HTMLElement;
    expect(hostCompacto.querySelector('ui-segmented')).toBeNull();
    expect(hostCompacto.querySelector('.certames-list')).toBeTruthy();
    expect(hostCompacto.querySelector('.certames-grid')).toBeNull();
  });

  it('lembra a visão escolhida entre visitas (localStorage)', async () => {
    await flushLista([sisu], contadoresHeaders);

    component['setVisao']('cards');
    fixture.detectChanges();

    expect(localStorage.getItem('uniplus.portal.certames-visao')).toBe('cards');
  });
});
