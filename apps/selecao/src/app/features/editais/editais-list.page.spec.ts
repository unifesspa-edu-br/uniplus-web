import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor, buildVendorMimeAccept } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { EditalDto, SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { EditaisListPage } from './editais-list.page';

const BASE = 'http://localhost:5000';
const ACCEPT = buildVendorMimeAccept('edital', 1);

const editalSeed = (
  numero: string,
  id = `01960000-0000-7000-0000-0000000000${numero}`,
): EditalDto => ({
  id,
  numeroEdital: `0${numero}/2026`,
  titulo: `Edital ${numero}`,
  tipoEditalId: null,
  status: 'Rascunho',
  maximoOpcoesCurso: 2,
  bonusRegionalHabilitado: false,
  criadoEm: '2026-04-15T12:00:00Z',
});

describe('EditaisListPage', () => {
  let fixture: ComponentFixture<EditaisListPage>;
  let component: EditaisListPage;
  let controller: HttpTestingController;
  let notifications: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [EditaisListPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });

    fixture = TestBed.createComponent(EditaisListPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    notifications = TestBed.inject(NotificationService);
    notifications.clearAll();
  });

  afterEach(() => controller.verify());

  it('carga inicial dispara GET /api/selecao/editais sem cursor e popula a lista', () => {
    fixture.detectChanges();

    expect(component.loading()).toBe(true);

    const req = controller.expectOne(
      (request) => request.url === `${BASE}/api/selecao/editais` && !request.params.has('cursor'),
    );
    expect(req.request.headers.get('Accept')).toBe(ACCEPT);
    req.flush([editalSeed('41'), editalSeed('42')]);

    expect(component.loading()).toBe(false);
    expect(component.errorMessage()).toBeNull();
    expect(component.editais()).toHaveLength(2);
  });

  it('extrai prev/next cursors do header Link da resposta de sucesso', () => {
    fixture.detectChanges();

    const req = controller.expectOne(`${BASE}/api/selecao/editais`);
    req.flush([editalSeed('40')], {
      headers: {
        Link:
          '<https://api/selecao/editais?cursor=opaque-prev&direction=prev>; rel="prev", ' +
          '<https://api/selecao/editais?cursor=opaque-next-page&direction=next>; rel="next"',
      },
    });

    expect(component.prevCursor()).toBe('opaque-prev');
    expect(component.nextCursor()).toBe('opaque-next-page');
  });

  it('navegação "Próximo" substitui a página, envia direction=next e atualiza cursores', () => {
    fixture.detectChanges();

    controller.expectOne(`${BASE}/api/selecao/editais`).flush([editalSeed('40')], {
      headers: {
        Link: '<https://api/selecao/editais?cursor=cursor-pagina-2&direction=next>; rel="next"',
      },
    });

    const cursorPagina2 = component.nextCursor();
    expect(cursorPagina2).toBe('cursor-pagina-2');
    if (!cursorPagina2) {
      throw new Error('Cursor da página 2 não foi extraído.');
    }

    component['aoProxima'](cursorPagina2);

    const req = controller.expectOne(
      (request) =>
        request.url === `${BASE}/api/selecao/editais` &&
        request.params.get('cursor') === 'cursor-pagina-2' &&
        request.params.get('direction') === 'next',
    );
    req.flush([editalSeed('41'), editalSeed('42')], {
      headers: {
        Link:
          '<https://api/selecao/editais?cursor=cursor-pagina-1&direction=prev>; rel="prev", ' +
          '<https://api/selecao/editais?cursor=cursor-pagina-3&direction=next>; rel="next"',
      },
    });

    // Substituição (ADR-0089): a página 2 troca a 1 — 2 items, não 3.
    expect(component.editais()).toHaveLength(2);
    expect(component.editais()[0].numeroEdital).toBe('041/2026');
    expect(component.editais()[1].numeroEdital).toBe('042/2026');
    expect(component.prevCursor()).toBe('cursor-pagina-1');
    expect(component.nextCursor()).toBe('cursor-pagina-3');
  });

  it('navegação "Anterior" envia direction=prev e substitui a página', () => {
    fixture.detectChanges();

    // 1ª página com next disponível
    controller.expectOne(`${BASE}/api/selecao/editais`).flush([editalSeed('43')], {
      headers: {
        Link: '<https://api/selecao/editais?cursor=c2&direction=next>; rel="next"',
      },
    });
    const cursorProximo = component.nextCursor();
    if (!cursorProximo) {
      throw new Error('Cursor "next" não foi extraído.');
    }
    component['aoProxima'](cursorProximo);
    controller
      .expectOne((request) => request.params.get('cursor') === 'c2')
      .flush([editalSeed('44')], {
        headers: {
          Link: '<https://api/selecao/editais?cursor=c1&direction=prev>; rel="prev"',
        },
      });

    const cursorAnterior = component.prevCursor();
    if (cursorAnterior === null) {
      throw new Error('Cursor "prev" não foi extraído.');
    }
    expect(cursorAnterior).toBe('c1');
    component['aoAnterior'](cursorAnterior);

    const req = controller.expectOne(
      (request) =>
        request.params.get('cursor') === 'c1' && request.params.get('direction') === 'prev',
    );
    req.flush([editalSeed('43')]);

    expect(component.editais()).toHaveLength(1);
    expect(component.editais()[0].numeroEdital).toBe('043/2026');
  });

  it('1ª página não envia direction (servidor coage para next)', () => {
    fixture.detectChanges();

    const req = controller.expectOne(
      (request) => request.url === `${BASE}/api/selecao/editais` && !request.params.has('cursor'),
    );
    expect(req.request.params.has('direction')).toBe(false);
    req.flush([editalSeed('40')]);
  });

  it('última página (sem rel="prev"/"next") zera os cursores', () => {
    fixture.detectChanges();

    controller.expectOne(`${BASE}/api/selecao/editais`).flush([editalSeed('40')], {
      headers: {
        Link: '<https://api/selecao/editais>; rel="self"',
      },
    });

    expect(component.prevCursor()).toBeNull();
    expect(component.nextCursor()).toBeNull();
  });

  it('falha 4xx na carga inicial popula errorMessage; cursor permanece null', () => {
    fixture.detectChanges();

    controller.expectOne(`${BASE}/api/selecao/editais`).flush(
      {
        type: 'about:blank',
        title: 'Token de acesso inválido',
        status: 401,
        code: 'uniplus.auth.token_invalido',
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      },
      {
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );

    expect(component.errorMessage()).toBe('Token de acesso inválido');
    expect(component.loading()).toBe(false);
    expect(component.nextCursor()).toBeNull();
    expect(component.editais()).toEqual([]);
  });

  it('falha em navegação preserva a página atual e seus cursores (retry possível)', () => {
    fixture.detectChanges();

    // 1ª página OK: ganha cursor para a próxima
    controller.expectOne(`${BASE}/api/selecao/editais`).flush([editalSeed('40')], {
      headers: {
        Link: '<https://api/selecao/editais?cursor=cursor-retry&direction=next>; rel="next"',
      },
    });

    expect(component.editais()).toHaveLength(1);
    const cursorRetry = component.nextCursor();
    expect(cursorRetry).toBe('cursor-retry');
    if (!cursorRetry) {
      throw new Error('Cursor de retry não foi extraído.');
    }

    // 2ª página falha
    component['aoProxima'](cursorRetry);
    controller
      .expectOne((request) => request.params.get('cursor') === 'cursor-retry')
      .flush(
        {
          type: 'about:blank',
          title: 'Falha temporária do servidor',
          status: 503,
          code: 'uniplus.server.indisponivel',
          traceId: '7af92f3577b34da6a3ce929d0e0e4742',
        },
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/problem+json' },
        },
      );

    expect(component.errorMessage()).toBe('Falha temporária do servidor');
    expect(component.loading()).toBe(false);
    // Página atual (1) preservada; cursor mantido para o retry refazer.
    expect(component.editais()).toHaveLength(1);
    expect(component.nextCursor()).toBe('cursor-retry');

    // Retry refaz exatamente a navegação que falhou (mesmo cursor + direction).
    component['aoTentarNovamente']();
    const retry = controller.expectOne(
      (request) =>
        request.params.get('cursor') === 'cursor-retry' &&
        request.params.get('direction') === 'next',
    );
    retry.flush([editalSeed('41'), editalSeed('42')]);
    expect(component.editais()).toHaveLength(2);
    expect(component.errorMessage()).toBeNull();
  });

  it('renderiza ui-data-table com dados e header correto após carga inicial', () => {
    fixture.detectChanges();
    controller.expectOne(`${BASE}/api/selecao/editais`).flush([editalSeed('40')]);
    fixture.detectChanges();

    const heading = fixture.debugElement.query(By.css('h1.page-header__title'))
      .nativeElement as HTMLElement;
    expect(heading.textContent).toContain('Editais');

    const linhas = fixture.debugElement.queryAll(By.css('[data-testid="data-table-row"]'));
    expect(linhas.length).toBe(1);
    const cells = fixture.debugElement.queryAll(By.css('tbody td'));
    expect(cells[0].nativeElement.textContent.trim()).toBe('040/2026');
  });

  it('5xx dispara toast persistente via NotificationService (CA-04)', () => {
    fixture.detectChanges();

    controller.expectOne(`${BASE}/api/selecao/editais`).flush(
      {
        type: 'about:blank',
        title: 'Falha temporária do servidor',
        status: 503,
        code: 'uniplus.server.indisponivel',
        traceId: '7af92f3577b34da6a3ce929d0e0e4742',
      },
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );

    expect(notifications.notifications()).toHaveLength(1);
    const [toast] = notifications.notifications();
    expect(toast.type).toBe('error');
    expect(toast.title).toBe('Falha temporária do servidor');
    expect(toast.traceId).toBe('7af92f3577b34da6a3ce929d0e0e4742');
    expect(toast.persistent).toBe(true);
  });

  it('4xx NÃO dispara toast — apenas banner inline (CA-04)', () => {
    fixture.detectChanges();

    controller.expectOne(`${BASE}/api/selecao/editais`).flush(
      {
        type: 'about:blank',
        title: 'Token inválido',
        status: 401,
        code: 'uniplus.auth.token_invalido',
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      },
      {
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );

    expect(component.errorMessage()).toBe('Token inválido');
    expect(notifications.notifications()).toHaveLength(0);
  });

  it('errorTraceId é propagado ao DataTable em falha 5xx', () => {
    fixture.detectChanges();

    controller.expectOne(`${BASE}/api/selecao/editais`).flush(
      {
        type: 'about:blank',
        title: 'Falha do servidor',
        status: 502,
        code: 'uniplus.server.gateway',
        traceId: 'cafe1234567890abcdef1234567890ab',
      },
      {
        status: 502,
        statusText: 'Bad Gateway',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );

    expect(component.errorTraceId()).toBe('cafe1234567890abcdef1234567890ab');
  });
});
