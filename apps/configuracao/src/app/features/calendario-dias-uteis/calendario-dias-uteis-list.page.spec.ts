import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApplicationRef } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import {
  CalendarioDiasUteisResumoDto,
  CONFIGURACAO_BASE_PATH,
} from '@uniplus/shared-data/configuracao';
import { apiResultInterceptor, mockProblemDetails } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';

import { CalendarioDiasUteisListPage } from './calendario-dias-uteis-list.page';

const BASE = 'http://localhost:5000';

const CALENDARIO_ID = '019f41cf-69fd-759a-ac6d-09acabc1b027';
const CALENDARIO_DIAS_UTEIS: CalendarioDiasUteisResumoDto = {
  id: CALENDARIO_ID,
  versaoDataset: '2026.2',
  vigente: false,
  criadoEm: '2026-07-07T13:23:42.707136+00:00',
};

describe('CalendarioDiasUteisListPage', async () => {
  let fixture: ComponentFixture<CalendarioDiasUteisListPage>;
  let component: CalendarioDiasUteisListPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CalendarioDiasUteisListPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(CalendarioDiasUteisListPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const propagate = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
  };

  async function flushLista(
    items: readonly CalendarioDiasUteisResumoDto[],
    link?: string,
  ): Promise<void> {
    const req = controller.expectOne(
      (r) => r.url === `${BASE}/api/configuracao/calendarios-dias-uteis`,
    );
    expect(req.request.params.get('limit')).toBe('50');
    req.flush(items, { headers: link ? { Link: link } : undefined });
    await propagate();
  }

  // Pós-mutação, `recarregar()` só dá reload no resource da lista principal —
  // os lookups de Curso/Local de oferta já estão em cache e não recarregam.
  async function flushRecarregarLista(
    items: readonly CalendarioDiasUteisResumoDto[],
  ): Promise<void> {
    await propagate();
    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/calendarios-dias-uteis`)
      .flush(items);
    await propagate();
  }

  it('exibe empty-state quando não há calendário cadastrados', async () => {
    await flushLista([]);
    await propagate();
    expect(fixture.nativeElement.textContent).toContain('Nenhum calendário encontrado');
    expect(fixture.nativeElement.textContent).toContain(
      'Cadastre o primeiro calendário de dias úteis.',
    );
  });

  it('exibe um calendário cadastrado', async () => {
    await flushLista([CALENDARIO_DIAS_UTEIS]);
    await propagate();
    expect(component['calendarios']().length).toBe(1);
  });

  const getMarcarVigenteButtonEl = () =>
    fixture.nativeElement.querySelector('.table-responsive__actions > button') as HTMLButtonElement;

  const getRemoverButtonEl = () =>
    fixture.nativeElement.querySelector(
      '.table-responsive__actions > button:last-child',
    ) as HTMLButtonElement;

  it('exibe o botão de marcar vigente habilitado em um registro que não é vigente', async () => {
    await flushLista([CALENDARIO_DIAS_UTEIS]);
    await propagate();
    const buttonEl = getMarcarVigenteButtonEl();
    expect(buttonEl.disabled).toBe(false);
  });

  it('exibe o botão de marcar vigente desabilitado em um registro que é vigente', async () => {
    const calendarioVigente = {
      ...CALENDARIO_DIAS_UTEIS,
      vigente: true,
    };
    await flushLista([calendarioVigente]);
    await propagate();
    const buttonEl = getMarcarVigenteButtonEl();
    expect(buttonEl.disabled).toBe(true);
  });

  it('exibe botão de remoção desabilitado quando é vigente', async () => {
    const calendarioVigente = {
      ...CALENDARIO_DIAS_UTEIS,
      vigente: true,
    };
    await flushLista([calendarioVigente]);
    await propagate();
    const buttonEl = getRemoverButtonEl();
    expect(buttonEl.disabled).toBe(true);
  });

  it('exibe botão de remoção habilitado quando não é vigente', async () => {
    await flushLista([CALENDARIO_DIAS_UTEIS]);
    await propagate();
    const buttonEl = getRemoverButtonEl();
    expect(buttonEl.disabled).toBe(false);
  });

  it('marca vigente quando não é um registro vigente', async () => {
    await flushLista([CALENDARIO_DIAS_UTEIS]);
    await propagate();
    const buttonEl = fixture.nativeElement.querySelector(
      '.table-responsive__actions > button',
    ) as HTMLButtonElement;
    buttonEl.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    const req = controller.expectOne(
      (r) =>
        r.url === `${BASE}/api/configuracao/admin/calendarios-dias-uteis/${CALENDARIO_ID}/vigente`,
    );
    req.flush({}, { status: 204, statusText: 'Not Content' });
    await propagate();
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    expect(component['saving']()).toBe(false);
    await flushRecarregarLista([{ ...CALENDARIO_DIAS_UTEIS, vigente: true }]);
  });

  it('navega para a próxima página usando o cursor do header Link', async () => {
    await flushLista(
      [CALENDARIO_DIAS_UTEIS],
      `<${BASE}/api/configuracao/calendarios-dias-uteis?cursor=pagina-2&direction=next>; rel="next"`,
    );

    const nextButton = fixture.nativeElement.querySelector(
      '[data-pager="next"]',
    ) as HTMLButtonElement;
    nextButton.click();
    fixture.detectChanges();

    const req = controller.expectOne(
      (request) => request.url === `${BASE}/api/configuracao/calendarios-dias-uteis`,
    );
    expect(req.request.params.get('cursor')).toBe('pagina-2');
    expect(req.request.params.get('direction')).toBe('next');
    req.flush([]);
    await propagate();
  });

  it('libera as ações e apresenta erro de concorrência ao falhar a vigência', async () => {
    await flushLista([CALENDARIO_DIAS_UTEIS]);
    getMarcarVigenteButtonEl().click();

    const req = controller.expectOne(
      `${BASE}/api/configuracao/admin/calendarios-dias-uteis/${CALENDARIO_ID}/vigente`,
    );
    req.flush(
      mockProblemDetails({
        status: 409,
        title: 'Conflito de concorrência',
        code: 'uniplus.configuracao.calendario_dias_uteis.conflito_de_concorrencia',
      }),
      {
        status: 409,
        statusText: 'Conflict',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );
    await propagate();

    expect(component['saving']()).toBe(false);
    expect(TestBed.inject(NotificationService).notifications()[0]?.title).toBe(
      'Conflito de concorrência',
    );
  });

  it('remove um calendário não vigente', async () => {
    await flushLista([CALENDARIO_DIAS_UTEIS]);
    await propagate();
    const removerButtonEl = getRemoverButtonEl();
    removerButtonEl.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    const confirmarRemocaoButtonEl = fixture.nativeElement.querySelector(
      '.btn.btn--danger',
    ) as HTMLButtonElement;
    confirmarRemocaoButtonEl.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    const req = controller.expectOne(
      (r) => r.url === `${BASE}/api/configuracao/admin/calendarios-dias-uteis/${CALENDARIO_ID}`,
    );
    req.flush({}, { status: 204, statusText: 'Not Content' });
    expect(req.request.method).toBe('DELETE');
    await propagate();
    await flushRecarregarLista([]);
  });
});
