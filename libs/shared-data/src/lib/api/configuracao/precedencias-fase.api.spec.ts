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
  CriarPrecedenciaFaseCommand,
  PrecedenciaFaseDto,
  PrecedenciasFaseApi,
} from './precedencias-fase.api';
import { CONFIGURACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-0000000000a1';

const arestaSeed: PrecedenciaFaseDto = {
  id: ID,
  antecessoraCodigo: 'INSCRICAO',
  sucessoraCodigo: 'HOMOLOGACAO',
  permiteSobreposicao: false,
  criadoEm: '2026-07-15T12:00:00Z',
};

const criarCommand: CriarPrecedenciaFaseCommand = {
  antecessoraCodigo: 'AVALIACAO',
  sucessoraCodigo: 'CLASSIFICACAO',
  permiteSobreposicao: false,
};

describe('PrecedenciasFaseApi', () => {
  let api: PrecedenciasFaseApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(PrecedenciasFaseApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('listar() faz GET /api/configuracao/precedencias-fase com limit e Accept versionado', async () => {
    const promise = firstValueFrom(api.listar({ limit: 100 }));
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/precedencias-fase`);
    expect(req.request.params.get('limit')).toBe('100');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('precedencia-fase', 1));
    req.flush([arestaSeed]);
    const result = (await promise) as ApiResult<readonly PrecedenciaFaseDto[]>;
    expect(isApiOk(result)).toBe(true);
  });

  it('listar() com cursor envia cursor + direction e omite limit', async () => {
    const promise = firstValueFrom(api.listar({ cursor: 'abc', direction: 'prev' }));
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/precedencias-fase`);
    expect(req.request.params.get('cursor')).toBe('abc');
    expect(req.request.params.get('direction')).toBe('prev');
    expect(req.request.params.has('limit')).toBe(false);
    req.flush([arestaSeed]);
    await promise;
  });

  it('obter() faz GET /api/configuracao/precedencias-fase/{id} com Accept versionado', async () => {
    const promise = firstValueFrom(api.obter(ID));
    const req = controller.expectOne(`${BASE}/api/configuracao/precedencias-fase/${ID}`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('precedencia-fase', 1));
    req.flush(arestaSeed);
    const result = (await promise) as ApiResult<PrecedenciaFaseDto>;
    expect(isApiOk(result)).toBe(true);
  });

  it('criar() faz POST /api/configuracao/admin/precedencias-fase com Idempotency-Key e Accept JSON', async () => {
    const promise = firstValueFrom(api.criar(criarCommand, withIdempotencyKey('k')));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/precedencias-fase`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    expect(req.request.body).toEqual(criarCommand);
    req.flush(ID, { status: 201, statusText: 'Created' });
    const result = (await promise) as ApiResult<string>;
    expect(isApiOk(result)).toBe(true);
  });

  it('atualizar() faz PUT /api/configuracao/admin/precedencias-fase/{id} só com o sinalizador de sobreposição', async () => {
    const promise = firstValueFrom(
      api.atualizar(ID, { id: ID, permiteSobreposicao: true }, withIdempotencyKey('k')),
    );
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/precedencias-fase/${ID}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    expect(req.request.body).toEqual({ id: ID, permiteSobreposicao: true });
    expect(req.request.body).not.toHaveProperty('antecessoraCodigo');
    expect(req.request.body).not.toHaveProperty('sucessoraCodigo');
    req.flush(null, { status: 204, statusText: 'No Content' });
    const result = (await promise) as ApiResult<void>;
    expect(isApiOk(result)).toBe(true);
  });

  it('remover() faz DELETE /api/configuracao/admin/precedencias-fase/{id} sem Idempotency-Key', async () => {
    const promise = firstValueFrom(api.remover(ID));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/precedencias-fase/${ID}`);
    expect(req.request.method).toBe('DELETE');
    // O contrato não marca o DELETE como `RequiresIdempotencyKey`; enviar o
    // header seria divergência com a API.
    expect(req.request.headers.has('Idempotency-Key')).toBe(false);
    req.flush(null, { status: 204, statusText: 'No Content' });
    const result = (await promise) as ApiResult<void>;
    expect(isApiOk(result)).toBe(true);
  });
});
