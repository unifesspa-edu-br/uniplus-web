import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor, buildVendorMimeAccept } from '@uniplus/shared-core';
import { EditalDto, SELECAO_BASE_PATH } from '@uniplus/shared-data';
import { EditaisListPage } from './editais-list.page';

const BASE = 'http://localhost:5000';
const ACCEPT = buildVendorMimeAccept('edital', 1);

const editalSeed = (numero: string, id = `01960000-0000-7000-0000-0000000000${numero}`): EditalDto => ({
  id,
  numeroEdital: `0${numero}/2026`,
  titulo: `Edital ${numero}`,
  tipoProcesso: 'PSE',
  status: 'Rascunho',
  maximoOpcoesCurso: 2,
  bonusRegionalHabilitado: false,
  criadoEm: '2026-04-15T12:00:00Z',
});

describe('EditaisListPage', () => {
  let fixture: ComponentFixture<EditaisListPage>;
  let component: EditaisListPage;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [EditaisListPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });

    fixture = TestBed.createComponent(EditaisListPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('carga inicial dispara GET /api/editais sem cursor e popula a lista', () => {
    fixture.detectChanges();

    expect(component.loading()).toBe(true);

    const req = controller.expectOne(
      (request) => request.url === `${BASE}/api/editais` && !request.params.has('cursor'),
    );
    expect(req.request.headers.get('Accept')).toBe(ACCEPT);
    req.flush([editalSeed('41'), editalSeed('42')]);

    expect(component.loading()).toBe(false);
    expect(component.errorMessage()).toBeNull();
    expect(component.editais()).toHaveLength(2);
  });

  it('extrai nextCursor do header Link rel="next" da resposta de sucesso', () => {
    fixture.detectChanges();

    const req = controller.expectOne(`${BASE}/api/editais`);
    req.flush([editalSeed('40')], {
      headers: {
        Link: '<https://api/editais?cursor=opaque-next-page>; rel="next"',
      },
    });

    expect(component.nextCursor()).toBe('opaque-next-page');
  });

  it('paginação acumula items da próxima página e atualiza o cursor', () => {
    fixture.detectChanges();

    controller.expectOne(`${BASE}/api/editais`).flush([editalSeed('40')], {
      headers: {
        Link: '<https://api/editais?cursor=cursor-pagina-2>; rel="next"',
      },
    });

    expect(component.nextCursor()).toBe('cursor-pagina-2');

    component['aoCarregarMais'](component.nextCursor()!);

    const req = controller.expectOne(
      (request) => request.url === `${BASE}/api/editais` && request.params.get('cursor') === 'cursor-pagina-2',
    );
    req.flush([editalSeed('41'), editalSeed('42')], {
      headers: {
        Link: '<https://api/editais?cursor=cursor-pagina-3>; rel="next"',
      },
    });

    expect(component.editais()).toHaveLength(3);
    expect(component.editais()[0].numeroEdital).toBe('040/2026');
    expect(component.editais()[2].numeroEdital).toBe('042/2026');
    expect(component.nextCursor()).toBe('cursor-pagina-3');
  });

  it('última página (sem rel="next") zera o nextCursor', () => {
    fixture.detectChanges();

    controller.expectOne(`${BASE}/api/editais`).flush([editalSeed('40')], {
      headers: {
        Link: '<https://api/editais>; rel="self"',
      },
    });

    expect(component.nextCursor()).toBeNull();
  });

  it('falha 4xx na carga inicial popula errorMessage; cursor permanece null', () => {
    fixture.detectChanges();

    controller.expectOne(`${BASE}/api/editais`).flush(
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

  it('falha 4xx em load-more preserva cursor e items já carregados (retry possível)', () => {
    fixture.detectChanges();

    // 1ª página OK: ganha cursor para a próxima
    controller.expectOne(`${BASE}/api/editais`).flush([editalSeed('40')], {
      headers: {
        Link: '<https://api/editais?cursor=cursor-retry>; rel="next"',
      },
    });

    expect(component.editais()).toHaveLength(1);
    expect(component.nextCursor()).toBe('cursor-retry');

    // 2ª página falha
    component['aoCarregarMais'](component.nextCursor()!);
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
    // Items da 1ª página preservados; cursor mantido para retry.
    expect(component.editais()).toHaveLength(1);
    expect(component.nextCursor()).toBe('cursor-retry');
  });

  it('renderiza ui-data-table com dados e header correto após carga inicial', () => {
    fixture.detectChanges();
    controller.expectOne(`${BASE}/api/editais`).flush([editalSeed('40')]);
    fixture.detectChanges();

    const heading = fixture.debugElement.query(By.css('h2')).nativeElement as HTMLElement;
    expect(heading.textContent).toContain('Editais');

    const linhas = fixture.debugElement.queryAll(By.css('tbody tr'));
    expect(linhas.length).toBe(1);
    const cells = fixture.debugElement.queryAll(By.css('tbody td'));
    expect(cells[0].nativeElement.textContent.trim()).toBe('040/2026');
  });
});
