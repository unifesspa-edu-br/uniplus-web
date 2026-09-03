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
  CriarTipoProcessoCommand,
  TipoProcessoDto,
  TiposProcessoApi,
} from './tipos-processo.api';
import { CONFIGURACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-000000000051';

const tipoSeed: TipoProcessoDto = {
  id: ID,
  codigo: 'SISU',
  nome: 'SiSU',
  descricao: 'Sistema de Seleção Unificada.',
  ativo: true,
  criadoEm: '2026-08-11T12:00:00Z',
};

const criarCommand: CriarTipoProcessoCommand = {
  codigo: 'SISU',
  nome: 'SiSU',
  descricao: 'Sistema de Seleção Unificada.',
};

describe('TiposProcessoApi', () => {
  let api: TiposProcessoApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(TiposProcessoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('listar() faz GET público com limit e Accept tipo-processo v1', async () => {
    const promise = firstValueFrom(api.listar({ limit: 50 }));
    const req = controller.expectOne(`${BASE}/api/configuracao/tipos-processo?limit=50`);

    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('tipo-processo', 1));
    req.flush([tipoSeed]);

    const result = (await promise) as ApiResult<readonly TipoProcessoDto[]>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) expect(result.data).toEqual([tipoSeed]);
  });

  it('listar() repassa o cursor opaco sem decodificá-lo', async () => {
    const cursor = 'aes-gcm:V2l0aCtwbHVzL3NpZ25zPT0=';
    const promise = firstValueFrom(api.listar({ cursor, direction: 'prev' }));
    const req = controller.expectOne(
      (request) => request.url === `${BASE}/api/configuracao/tipos-processo`,
    );

    expect(req.request.params.get('cursor')).toBe(cursor);
    expect(req.request.params.get('direction')).toBe('prev');
    expect(req.request.params.has('limit')).toBe(false);
    req.flush([tipoSeed]);
    await promise;
  });

  it('obter() faz GET /api/configuracao/tipos-processo/{id} com Accept versionado', async () => {
    const promise = firstValueFrom(api.obter(ID));
    const req = controller.expectOne(`${BASE}/api/configuracao/tipos-processo/${ID}`);

    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('tipo-processo', 1));
    req.flush(tipoSeed);

    const result = (await promise) as ApiResult<TipoProcessoDto>;
    expect(isApiOk(result)).toBe(true);
  });

  it('criar() faz POST /api/configuracao/admin/tipos-processo com Idempotency-Key e Accept JSON', async () => {
    const promise = firstValueFrom(api.criar(criarCommand, withIdempotencyKey('k')));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-processo`);

    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    req.flush(ID, { status: 201, statusText: 'Created' });

    const result = (await promise) as ApiResult<string>;
    expect(isApiOk(result)).toBe(true);
  });

  it('atualizar() faz PUT /api/configuracao/admin/tipos-processo/{id} sem o campo codigo', async () => {
    const promise = firstValueFrom(
      api.atualizar(
        ID,
        { id: ID, nome: 'SiSU (revisado)', descricao: null },
        withIdempotencyKey('k'),
      ),
    );
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-processo/${ID}`);

    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    expect(req.request.body).not.toHaveProperty('codigo');
    req.flush(null, { status: 204, statusText: 'No Content' });

    const result = (await promise) as ApiResult<void>;
    expect(isApiOk(result)).toBe(true);
  });

  it('remover() faz DELETE /api/configuracao/admin/tipos-processo/{id}', async () => {
    const promise = firstValueFrom(api.remover(ID));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-processo/${ID}`);

    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });

    const result = (await promise) as ApiResult<void>;
    expect(isApiOk(result)).toBe(true);
  });
});
