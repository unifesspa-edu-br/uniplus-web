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
  CriarLocalOfertaCommand,
  LocaisOfertaApi,
  LocalOfertaDto,
  TIPOS_LOCAL_OFERTA,
} from './locais-oferta.api';
import { CONFIGURACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-0000000000d1';

const localSeed: LocalOfertaDto = {
  id: ID,
  tipo: 'poloEad',
  codigoEmec: '999',
  campusResponsavelId: null,
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

const criarCommand: CriarLocalOfertaCommand = {
  tipo: 'poloEad',
  codigoEmec: '999',
  campusResponsavelId: null,
  cidadeCodigoIbge: '1504208',
  cidadeNome: 'Marabá',
  cidadeUf: 'PA',
  endereco: null,
};

describe('LocaisOfertaApi', () => {
  let api: LocaisOfertaApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(LocaisOfertaApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('TIPOS_LOCAL_OFERTA cobre o roster do enum (sem "nenhum")', () => {
    expect(TIPOS_LOCAL_OFERTA.map((t) => t.value)).toEqual([
      'campusSede',
      'campusForaDeSede',
      'cursoForaDeSede',
      'poloEad',
      'convenioInteriorizacao',
      'outro',
    ]);
  });

  it('listar() faz GET /api/locais-oferta com Accept versionado', async () => {
    const promise = firstValueFrom(api.listar({ limit: 25 }));
    const req = controller.expectOne((r) => r.url === `${BASE}/api/locais-oferta`);
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('local-oferta', 1));
    req.flush([localSeed]);
    const result = (await promise) as ApiResult<readonly LocalOfertaDto[]>;
    expect(isApiOk(result)).toBe(true);
  });

  it('criar() faz POST /api/admin/locais-oferta com Idempotency-Key', async () => {
    const promise = firstValueFrom(api.criar(criarCommand, withIdempotencyKey('k')));
    const req = controller.expectOne(`${BASE}/api/admin/locais-oferta`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    req.flush(ID, { status: 201, statusText: 'Created' });
    const result = (await promise) as ApiResult<string>;
    expect(isApiOk(result)).toBe(true);
  });

  it('atualizar() faz PUT /api/admin/locais-oferta/{id}', async () => {
    const promise = firstValueFrom(
      api.atualizar(ID, { ...criarCommand, id: ID }, withIdempotencyKey('k2')),
    );
    const req = controller.expectOne(`${BASE}/api/admin/locais-oferta/${ID}`);
    expect(req.request.method).toBe('PUT');
    req.flush(null, { status: 204, statusText: 'No Content' });
    const result = (await promise) as ApiResult<void>;
    expect(isApiOk(result)).toBe(true);
  });
});
