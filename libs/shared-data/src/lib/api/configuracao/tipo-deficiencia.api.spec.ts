import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ApiResult,
  apiResultInterceptor,
  buildVendorMimeAccept,
  isApiOk,
  withIdempotencyKey,
} from '@uniplus/shared-core/http';
import {
  AtualizarCondicaoAtendimentoCommand,
  CONFIGURACAO_BASE_PATH,
  TipoDeficienciaDto,
  CriarTipoDeficienciaCommand,
  TipoDeficienciaApi,
} from '@uniplus/shared-data/configuracao';

const BASE = 'http://localhost:5000';

const TIPO_DEFICIENCIA_ID = '019f41cf-69fd-759a-ac6d-09acabc1b027';

const tipoDeficienciaSeed: TipoDeficienciaDto = {
  id: TIPO_DEFICIENCIA_ID,
  nome: 'Visual',
  descricao: 'Inclui baixa visão e cegueira',
  criadoEm: '2026-06-10T12:00:00Z',
};

const criarCommand: CriarTipoDeficienciaCommand = {
  nome: 'Visual',
  descricao: 'Inclui baixa visão e cegueira',
};

const atualizarCommand: AtualizarCondicaoAtendimentoCommand = {
  id: TIPO_DEFICIENCIA_ID,
  codigo: 'PCD',
  nome: 'Pessoa com Deficiência (PCD)',
  descricao: 'LBI (Lei 13.146/2015), art. 30',
};

describe('TipoDeficienciaApi', () => {
  let api: TipoDeficienciaApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(TipoDeficienciaApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('listar() faz GET /api/configuracao/tipos-deficiencia com limit e Accept versionado', async () => {
    const promise = firstValueFrom(api.listar({ limit: 50 }));
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-deficiencia`);
    expect(req.request.params.get('limit')).toBe('50');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('tipo-deficiencia', 1));
    req.flush([tipoDeficienciaSeed]);
    const result = (await promise) as ApiResult<readonly TipoDeficienciaDto[]>;
    expect(isApiOk(result)).toBe(true);
  });

  it('listar() com cursor envia cursor + direction e omite limit', async () => {
    const promise = firstValueFrom(api.listar({ cursor: 'abc', direction: 'prev' }));
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-deficiencia`);
    expect(req.request.params.get('cursor')).toBe('abc');
    expect(req.request.params.get('direction')).toBe('prev');
    expect(req.request.params.has('limit')).toBe(false);
    req.flush([tipoDeficienciaSeed]);
    await promise;
  });

  it('criar() faz POST /api/configuracao/admin/tipos-deficiencia com Idempotency-Key e Accept JSON', async () => {
    const promise = firstValueFrom(api.criar(criarCommand, withIdempotencyKey('k')));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-deficiencia`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    req.flush(TIPO_DEFICIENCIA_ID, { status: 201, statusText: 'Created' });
    const result = (await promise) as ApiResult<string>;
    expect(isApiOk(result)).toBe(true);
  });

  it('atualizar() faz PUT /api/configuracao/admin/tipos-deficiencia com Idempotency-Key', async () => {
    const promise = firstValueFrom(api.atualizar(atualizarCommand.id, atualizarCommand, withIdempotencyKey('k')));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-deficiencia/${TIPO_DEFICIENCIA_ID}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    req.flush(TIPO_DEFICIENCIA_ID, { status: 204, statusText: 'No Content' });
    const result = (await promise) as ApiResult<string>;
    expect(isApiOk(result)).toBe(true);
  });

  it('remover() faz DELETE /api/configuracao/admin/tipos-deficiencia/{id}', async () => {
    const promise = firstValueFrom(api.remover(TIPO_DEFICIENCIA_ID));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-deficiencia/${TIPO_DEFICIENCIA_ID}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    const result = (await promise) as ApiResult<void>;
    expect(isApiOk(result)).toBe(true);
  });
});
