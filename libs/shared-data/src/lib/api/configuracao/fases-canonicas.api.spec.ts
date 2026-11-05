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
} from '@uniplus/shared-core/http';
import { withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { FaseCanonicaDto, FasesCanonicasApi } from './fases-canonicas.api';
import { CONFIGURACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-0000000000f1';

const faseSeed: FaseCanonicaDto = {
  id: ID,
  codigo: 'AVALIACAO',
  nome: 'Avaliação',
  descricao: null,
  unidadeSugerida: null,
  agrupaEtapas: true,
  permiteComplementacao: false,
  baseLegal: null,
  coletaInscricao: false,
  coletaSolicitacaoIsencao: false,
  origemData: 'NO_EDITAL',
  criadoEm: '2026-06-10T12:00:00Z',
};

describe('FasesCanonicasApi', () => {
  let api: FasesCanonicasApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(FasesCanonicasApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('listar() faz GET /api/configuracao/fases-canonicas com limit e Accept versionado', async () => {
    const promise = firstValueFrom(api.listar({ limit: 50 }));
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/fases-canonicas`);
    expect(req.request.params.get('limit')).toBe('50');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('fase-canonica', 1));
    req.flush([faseSeed]);
    const result = (await promise) as ApiResult<readonly FaseCanonicaDto[]>;
    expect(isApiOk(result)).toBe(true);
  });

  it('listar() com cursor envia cursor + direction e omite limit', async () => {
    const promise = firstValueFrom(api.listar({ cursor: 'abc', direction: 'prev' }));
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/fases-canonicas`);
    expect(req.request.params.get('cursor')).toBe('abc');
    expect(req.request.params.get('direction')).toBe('prev');
    expect(req.request.params.has('limit')).toBe(false);
    req.flush([faseSeed]);
    await promise;
  });

  it('atualizar() faz PUT /api/configuracao/admin/fases-canonicas/{id} sem o campo codigo', async () => {
    const promise = firstValueFrom(
      api.atualizar(
        ID,
        {
          id: ID,
          nome: 'Avaliação (revisada)',
          descricao: null,
          unidadeSugeridaId: null,
          agrupaEtapas: true,
          permiteComplementacao: false,
          baseLegal: null,
          coletaInscricao: false,
          coletaSolicitacaoIsencao: false,
        },
        withIdempotencyKey('k'),
      ),
    );
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/fases-canonicas/${ID}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).not.toHaveProperty('codigo');
    req.flush(null, { status: 204, statusText: 'No Content' });
    const result = (await promise) as ApiResult<void>;
    expect(isApiOk(result)).toBe(true);
  });

  it('remover() faz DELETE /api/configuracao/admin/fases-canonicas/{id}', async () => {
    const promise = firstValueFrom(api.remover(ID));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/fases-canonicas/${ID}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    const result = (await promise) as ApiResult<void>;
    expect(isApiOk(result)).toBe(true);
  });
});
