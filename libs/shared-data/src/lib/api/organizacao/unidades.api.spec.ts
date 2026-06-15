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
  AtualizarUnidadeCommand,
  CriarUnidadeCommand,
  TIPOS_UNIDADE,
  UnidadeDto,
  UnidadesApi,
} from './unidades.api';
import { ORGANIZACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-000000000101';

const unidadeSeed: UnidadeDto = {
  id: ID,
  nome: 'Instituto de Estudos em Desenvolvimento Agrário e Regional',
  alias: 'IEDAR',
  slug: 'iedar',
  sigla: 'IEDAR',
  codigo: 'IEDAR',
  unidadeSuperiorId: null,
  tipo: 'Instituto',
  unidadeAcademica: true,
  vigenciaInicio: '2026-01-01',
  vigenciaFim: null,
  origem: 'CriadoNoUniPlus',
  criadoEm: '2026-06-10T12:00:00Z',
};

const criarCommand: CriarUnidadeCommand = {
  nome: unidadeSeed.nome,
  alias: unidadeSeed.alias,
  slug: unidadeSeed.slug,
  sigla: unidadeSeed.sigla,
  codigo: unidadeSeed.codigo,
  unidadeSuperiorId: null,
  tipo: 4,
  unidadeAcademica: true,
  vigenciaInicio: '2026-01-01',
  vigenciaFim: null,
  origem: 2,
};

const atualizarCommand: AtualizarUnidadeCommand = {
  id: ID,
  nome: unidadeSeed.nome,
  alias: unidadeSeed.alias,
  slug: unidadeSeed.slug,
  sigla: unidadeSeed.sigla,
  codigo: unidadeSeed.codigo,
  unidadeSuperiorId: null,
  tipo: 4,
  unidadeAcademica: true,
  vigenciaFim: null,
  motivoMudancaIdentificador: null,
};

describe('UnidadesApi', () => {
  let api: UnidadesApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(UnidadesApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('obter() faz GET /api/unidades/{id} com encoding seguro', async () => {
    const id = 'id com espaço/01';
    const promise = firstValueFrom(api.obter(id));

    const req = controller.expectOne(`${BASE}/api/unidades/${encodeURIComponent(id)}`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('unidade', 1));
    req.flush(unidadeSeed);

    await promise;
  });

  it('criar() faz POST /api/admin/unidades com Idempotency-Key e Accept JSON', async () => {
    const key = 'unidade-create-key';
    const promise = firstValueFrom(api.criar(criarCommand, withIdempotencyKey(key)));

    const req = controller.expectOne(`${BASE}/api/admin/unidades`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe(key);
    expect(req.request.headers.get('Accept')).toBe('application/json');
    expect(req.request.body).toEqual(criarCommand);
    req.flush(ID, { status: 201, statusText: 'Created' });

    const result = (await promise) as ApiResult<string>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) {
      expect(result.data).toBe(ID);
    }
  });

  it('expõe labels acentuados para tipos de unidade na UI', () => {
    expect(TIPOS_UNIDADE).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 2, label: 'Pró-Reitoria' }),
        expect.objectContaining({ value: 7, label: 'Coordenação' }),
        expect.objectContaining({ value: 9, label: 'Divisão' }),
        expect.objectContaining({ value: 10, label: 'Núcleo' }),
      ]),
    );
  });

  it('atualizar() faz PUT /api/admin/unidades/{id} com Idempotency-Key', async () => {
    const key = 'unidade-update-key';
    const promise = firstValueFrom(api.atualizar(ID, atualizarCommand, withIdempotencyKey(key)));

    const req = controller.expectOne(`${BASE}/api/admin/unidades/${ID}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('Idempotency-Key')).toBe(key);
    expect(req.request.body).toEqual(atualizarCommand);
    req.flush(null, { status: 204, statusText: 'No Content' });

    const result = (await promise) as ApiResult<void>;
    expect(isApiOk(result)).toBe(true);
  });

  it('remover() faz DELETE sem Idempotency-Key porque o backend não exige o header', async () => {
    const promise = firstValueFrom(api.remover(ID));

    const req = controller.expectOne(`${BASE}/api/admin/unidades/${ID}`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.headers.has('Idempotency-Key')).toBe(false);
    req.flush(null, { status: 204, statusText: 'No Content' });

    const result = (await promise) as ApiResult<void>;
    expect(isApiOk(result)).toBe(true);
  });
});
