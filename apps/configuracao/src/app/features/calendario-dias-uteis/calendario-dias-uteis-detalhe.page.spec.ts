import { ApplicationRef } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { apiResultInterceptor, mockProblemDetails } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { of } from 'rxjs';

import { CalendarioDiasUteisDetalhePage } from './calendario-dias-uteis-detalhe.page';

const BASE = 'http://localhost:5000';
const CALENDARIO_ID = '019f41cf-69fd-759a-ac6d-09acabc1b027';

describe('CalendarioDiasUteisDetalhePage', () => {
  let fixture: ComponentFixture<CalendarioDiasUteisDetalhePage>;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CalendarioDiasUteisDetalhePage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ id: CALENDARIO_ID }) },
            params: of({ id: CALENDARIO_ID }),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(CalendarioDiasUteisDetalhePage);
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const propagate = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
  };

  it('exibe erro de carregamento e permite tentar novamente', async () => {
    const url = `${BASE}/api/configuracao/calendarios-dias-uteis/${CALENDARIO_ID}`;
    controller
      .expectOne(url)
      .flush(mockProblemDetails({ status: 404, title: 'Calendário não encontrado' }), {
        status: 404,
        statusText: 'Not Found',
        headers: { 'Content-Type': 'application/problem+json' },
      });
    await propagate();

    expect(fixture.nativeElement.textContent).toContain('Calendário não encontrado');
    expect(fixture.nativeElement.querySelector('section.form-section')).toBeNull();

    const retry = fixture.nativeElement.querySelector(
      '.cfg-calendario-dias-uteis__retry button',
    ) as HTMLButtonElement;
    retry.click();
    fixture.detectChanges();

    controller.expectOne(url).flush({
      id: CALENDARIO_ID,
      versaoDataset: '2026.1',
      vigente: false,
      criadoEm: '2026-08-13T00:00:00Z',
      diasNaoUteis: [],
    });
    await propagate();

    expect((fixture.nativeElement.querySelector('input') as HTMLInputElement).value).toBe('2026.1');
  });
});
