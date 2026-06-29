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
  AtualizarPesoAreaEnemCommand,
  CriarPesoAreaEnemCommand,
  PesoAreaEnemDto,
  PesoEnemApi,
} from './peso-enem.api';
import { CONFIGURACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-0000000000f1';

const seed: PesoAreaEnemDto = {
  id: ID,
  resolucao: 'Res. 805/2024',
  grupoCurso: 'Tecnológica',
  pesoLinguagens: 1,
  pesoCienciasHumanas: 1,
  pesoCienciasNatureza: 2,
  pesoMatematica: 3,
  pesoRedacao: 1,
  corteRedacao: 400,
  baseLegal: 'Res. 805/2024 Anexo I',
  criadoEm: '2026-06-24T12:00:00Z',
};

const criarCommand: CriarPesoAreaEnemCommand = {
  resolucao: 'Res. 805/2024',
  grupoCurso: 'Tecnológica',
  pesoLinguagens: 1,
  pesoCienciasHumanas: 1,
  pesoCienciasNatureza: 2,
  pesoMatematica: 3,
  pesoRedacao: 1,
  baseLegal: 'Res. 805/2024 Anexo I',
  corteRedacao: 400,
};

const atualizarCommand: AtualizarPesoAreaEnemCommand = {
  id: ID,
  pesoLinguagens: 1,
  pesoCienciasHumanas: 1,
  pesoCienciasNatureza: 2,
  pesoMatematica: 3,
  pesoRedacao: 1,
  corteRedacao: 400,
  baseLegal: 'Res. 805/2024 Anexo I',
};

describe('PesoEnemApi', () => {
  let api: PesoEnemApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(PesoEnemApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('listar() faz GET no path de módulo com limit e Accept versionado', async () => {
    const promise = firstValueFrom(api.listar({ limit: 50 }));
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/pesos-area-enem`);
    expect(req.request.params.get('limit')).toBe('50');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('peso-area-enem', 1));
    req.flush([seed]);
    const result = (await promise) as ApiResult<readonly PesoAreaEnemDto[]>;
    expect(isApiOk(result)).toBe(true);
  });

  it('listar() com cursor envia cursor + direction e omite limit', async () => {
    const promise = firstValueFrom(api.listar({ cursor: 'abc', direction: 'prev' }));
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/pesos-area-enem`);
    expect(req.request.params.get('cursor')).toBe('abc');
    expect(req.request.params.get('direction')).toBe('prev');
    expect(req.request.params.has('limit')).toBe(false);
    req.flush([seed]);
    await promise;
  });

  it('obter() faz GET no path de módulo/{id} com Accept versionado', async () => {
    const promise = firstValueFrom(api.obter(ID));
    const req = controller.expectOne(`${BASE}/api/configuracao/pesos-area-enem/${ID}`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('peso-area-enem', 1));
    req.flush(seed);
    expect(isApiOk((await promise) as ApiResult<PesoAreaEnemDto>)).toBe(true);
  });

  it('criar() faz POST admin com Idempotency-Key e Accept JSON, retornando o Guid', async () => {
    const promise = firstValueFrom(api.criar(criarCommand, withIdempotencyKey('k')));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    expect(req.request.body).toEqual(criarCommand);
    req.flush(ID, { status: 201, statusText: 'Created' });
    expect(isApiOk((await promise) as ApiResult<string>)).toBe(true);
  });

  it('atualizar() faz PUT admin/{id} com Idempotency-Key', async () => {
    const promise = firstValueFrom(api.atualizar(ID, atualizarCommand, withIdempotencyKey('k2')));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${ID}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k2');
    expect(req.request.body).toEqual(atualizarCommand);
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(isApiOk((await promise) as ApiResult<void>)).toBe(true);
  });

  it('remover() faz DELETE admin/{id} sem Idempotency-Key (soft-delete)', async () => {
    const promise = firstValueFrom(api.remover(ID));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${ID}`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.headers.has('Idempotency-Key')).toBe(false);
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(isApiOk((await promise) as ApiResult<void>)).toBe(true);
  });
});
