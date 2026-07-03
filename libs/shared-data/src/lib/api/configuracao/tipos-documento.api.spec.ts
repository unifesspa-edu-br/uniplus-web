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
import { AtualizarTipoDocumentoCommand, CriarTipoDocumentoCommand, TipoDocumentoDto, TiposDocumentoApi } from './tipos-documento.api';
import { CONFIGURACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-0000000000d1';

const tipoDocumentoSeed: TipoDocumentoDto = {
  id: ID,
  codigo: 'RG',
  nome: 'Registro Geral',
  descricao: 'Documento de identificação civil.',
  categoria: 'IDENTIFICACAO',
  formatosAceitos: 'pdf,jpg,png',
  tamanhoMaximoMb: 10,
  tipoEquivalente: 'CIN',
  criadoEm: '2026-06-10T12:00:00Z',
};

const criarCommand: CriarTipoDocumentoCommand = {
  codigo: 'RG',
  nome: 'Registro Geral',
  categoria: 'IDENTIFICACAO',
  descricao: 'Documento de identificação civil.',
  formatosAceitos: 'pdf,jpg,png',
  tamanhoMaximoMb: 10,
  tipoEquivalente: 'CIN',
};

describe('TiposDocumentoApi', () => {
  let api: TiposDocumentoApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(TiposDocumentoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('listar() faz GET /api/configuracao/tipos-documento com limit e Accept versionado', async () => {
    const promise = firstValueFrom(api.listar({ limit: 50 }));
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-documento`);
    expect(req.request.params.get('limit')).toBe('50');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('tipo-documento', 1));
    req.flush([tipoDocumentoSeed]);
    const result = (await promise) as ApiResult<readonly TipoDocumentoDto[]>;
    expect(isApiOk(result)).toBe(true);
  });

  it('listar() com cursor envia cursor + direction e omite limit', async () => {
    const promise = firstValueFrom(api.listar({ cursor: 'abc', direction: 'prev' }));
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-documento`);
    expect(req.request.params.get('cursor')).toBe('abc');
    expect(req.request.params.get('direction')).toBe('prev');
    expect(req.request.params.has('limit')).toBe(false);
    req.flush([tipoDocumentoSeed]);
    await promise;
  });

  it('obter() faz GET /api/configuracao/tipos-documento/{id}', async () => {
    const promise = firstValueFrom(api.obter(ID));
    const req = controller.expectOne(`${BASE}/api/configuracao/tipos-documento/${ID}`);
    expect(req.request.method).toBe('GET');
    req.flush(tipoDocumentoSeed);
    const result = (await promise) as ApiResult<TipoDocumentoDto>;
    expect(isApiOk(result)).toBe(true);
  });

  it('criar() faz POST /api/configuracao/admin/tipos-documento com Idempotency-Key e Accept JSON', async () => {
    const promise = firstValueFrom(api.criar(criarCommand, withIdempotencyKey('k')));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-documento`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    req.flush(ID, { status: 201, statusText: 'Created' });
    const result = (await promise) as ApiResult<string>;
    expect(isApiOk(result)).toBe(true);
  });

  it('atualizar() faz PUT /api/configuracao/admin/tipos-documento/{id}', async () => {
    const command: AtualizarTipoDocumentoCommand = { id: ID, ...criarCommand };
    const promise = firstValueFrom(api.atualizar(ID, command, withIdempotencyKey('k')));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-documento/${ID}`);
    expect(req.request.method).toBe('PUT');
    req.flush(null, { status: 204, statusText: 'No Content' });
    const result = (await promise) as ApiResult<void>;
    expect(isApiOk(result)).toBe(true);
  });

  it('remover() faz DELETE /api/configuracao/admin/tipos-documento/{id}', async () => {
    const promise = firstValueFrom(api.remover(ID));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-documento/${ID}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    const result = (await promise) as ApiResult<void>;
    expect(isApiOk(result)).toBe(true);
  });
});
