import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { VENDOR_MIME_TOKEN, withIdempotencyKey } from '@uniplus/shared-core/http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CalendarioDiasUteisApi } from './calendario-dias-uteis.api';
import { CONFIGURACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const CALENDARIO_ID = '019f41cf-69fd-759a-ac6d-09acabc1b027';
const IDEMPOTENCY_KEY = '019f6a58-7f24-7d4a-b82c-3ff5c3c941f0';

describe('CalendarioDiasUteisApi', () => {
  let api: CalendarioDiasUteisApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(CalendarioDiasUteisApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('usa o vendor MIME do recurso ao listar', () => {
    api.listar({ limit: 50 }).subscribe();

    const req = controller.expectOne(`${BASE}/api/configuracao/calendarios-dias-uteis?limit=50`);
    expect(req.request.context.get(VENDOR_MIME_TOKEN)).toEqual({
      resource: 'calendario-dias-uteis',
      version: 1,
    });
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('marca vigente sem enviar command no corpo', () => {
    api.marcarVigente(CALENDARIO_ID, withIdempotencyKey(IDEMPOTENCY_KEY)).subscribe();

    const req = controller.expectOne(
      `${BASE}/api/configuracao/admin/calendarios-dias-uteis/${CALENDARIO_ID}/vigente`,
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});
