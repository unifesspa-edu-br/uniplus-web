import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ApiResult,
  apiResultInterceptor,
  buildVendorMimeAccept,
  isApiOk,
  withIdempotencyKey,
} from '@uniplus/shared-core/http';
import {
  CriarReferenciaReservaDemograficaCommand,
  ReferenciaReservaDemograficaDto,
  ReservaDemograficaApi,
} from './reserva-demografica.api';
import { CONFIGURACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-0000000000e1';

const seed: ReferenciaReservaDemograficaDto = {
  id: ID,
  censoReferencia: '2022',
  ppiPercentual: 78.5,
  quilombolaPercentual: 1.2,
  pcdPercentual: 8.4,
  baseLegal: 'Lei 12.711/2012, art. 10, III',
  criadoEm: '2026-06-10T12:00:00Z',
};

const criarCommand: CriarReferenciaReservaDemograficaCommand = {
  censoReferencia: '2022',
  ppiPercentual: 78.5,
  quilombolaPercentual: 1.2,
  pcdPercentual: 8.4,
  baseLegal: 'Lei 12.711/2012, art. 10, III',
};

describe('ReservaDemograficaApi', () => {
  let api: ReservaDemograficaApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(ReservaDemograficaApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('listar() faz GET com limit e Accept versionado', async () => {
    const promise = firstValueFrom(api.listar({ limit: 50 }));
    const req = controller.expectOne((r) => r.url === `${BASE}/api/referencias-reserva-demografica`);
    expect(req.request.params.get('limit')).toBe('50');
    expect(req.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('referencia-reserva-demografica', 1),
    );
    req.flush([seed]);
    const result = (await promise) as ApiResult<readonly ReferenciaReservaDemograficaDto[]>;
    expect(isApiOk(result)).toBe(true);
  });

  it('listar() com cursor envia cursor + direction e omite limit', async () => {
    const promise = firstValueFrom(api.listar({ cursor: 'abc', direction: 'prev' }));
    const req = controller.expectOne((r) => r.url === `${BASE}/api/referencias-reserva-demografica`);
    expect(req.request.params.get('cursor')).toBe('abc');
    expect(req.request.params.get('direction')).toBe('prev');
    expect(req.request.params.has('limit')).toBe(false);
    req.flush([seed]);
    await promise;
  });

  it('criar() faz POST admin com Idempotency-Key e Accept JSON', async () => {
    const promise = firstValueFrom(api.criar(criarCommand, withIdempotencyKey('k')));
    const req = controller.expectOne(`${BASE}/api/admin/referencias-reserva-demografica`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    expect(req.request.body).toEqual(criarCommand);
    req.flush(ID, { status: 201, statusText: 'Created' });
    expect(isApiOk((await promise) as ApiResult<string>)).toBe(true);
  });

  it('atualizar() faz PUT admin/{id}', async () => {
    const promise = firstValueFrom(
      api.atualizar(ID, { ...criarCommand, id: ID }, withIdempotencyKey('k2')),
    );
    const req = controller.expectOne(`${BASE}/api/admin/referencias-reserva-demografica/${ID}`);
    expect(req.request.method).toBe('PUT');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(isApiOk((await promise) as ApiResult<void>)).toBe(true);
  });

  it('remover() faz DELETE admin/{id} (soft-delete)', async () => {
    const promise = firstValueFrom(api.remover(ID));
    const req = controller.expectOne(`${BASE}/api/admin/referencias-reserva-demografica/${ID}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(isApiOk((await promise) as ApiResult<void>)).toBe(true);
  });
});
