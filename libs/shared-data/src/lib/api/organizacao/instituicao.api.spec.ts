import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ApiResult,
  apiResultInterceptor,
  buildVendorMimeAccept,
  isApiFailure,
  isApiOk,
  withIdempotencyKey,
} from '@uniplus/shared-core/http';
import {
  AtualizarInstituicaoCommand,
  CriarInstituicaoCommand,
  InstituicaoApi,
  InstituicaoDto,
} from './instituicao.api';
import { ORGANIZACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-0000000000a1';

const instituicaoSeed: InstituicaoDto = {
  id: ID,
  codigoEmec: '3990',
  nome: 'Universidade Federal do Sul e Sudeste do Pará',
  sigla: 'Unifesspa',
  organizacaoAcademica: 'Universidade',
  categoriaAdministrativa: 'Pública Federal',
  cnpj: null,
  mantenedora: null,
  codigoMantenedoraEmec: null,
  situacao: null,
  atoCredenciamento: null,
  atoRecredenciamento: null,
  conceitoInstitucional: null,
  igc: null,
  website: null,
  enderecoSede: null,
  municipioSede: null,
  unidadeRaizId: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

const criarCommand: CriarInstituicaoCommand = {
  codigoEmec: instituicaoSeed.codigoEmec,
  nome: instituicaoSeed.nome,
  sigla: instituicaoSeed.sigla,
  organizacaoAcademica: instituicaoSeed.organizacaoAcademica,
  categoriaAdministrativa: instituicaoSeed.categoriaAdministrativa,
  cnpj: null,
  mantenedora: null,
  codigoMantenedoraEmec: null,
  situacao: null,
  atoCredenciamento: null,
  atoRecredenciamento: null,
  conceitoInstitucional: null,
  igc: null,
  website: null,
  enderecoSede: null,
  municipioSede: null,
  unidadeRaizId: null,
};

const atualizarCommand: AtualizarInstituicaoCommand = {
  id: ID,
  ...criarCommand,
};

describe('InstituicaoApi', () => {
  let api: InstituicaoApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(InstituicaoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('obter() faz GET /api/instituicao (singleton, sem id) com Accept versionado', async () => {
    const promise = firstValueFrom(api.obter());

    const req = controller.expectOne(`${BASE}/api/instituicao`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('instituicao', 1));
    req.flush(instituicaoSeed);

    const result = (await promise) as ApiResult<InstituicaoDto>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) {
      expect(result.data.sigla).toBe('Unifesspa');
    }
  });

  it('obter() devolve ApiFailure com status 404 quando não há Instituição viva', async () => {
    const promise = firstValueFrom(api.obter());

    const req = controller.expectOne(`${BASE}/api/instituicao`);
    req.flush(null, { status: 404, statusText: 'Not Found' });

    const result = (await promise) as ApiResult<InstituicaoDto>;
    expect(isApiFailure(result)).toBe(true);
    expect(result.status).toBe(404);
  });

  it('criar() faz POST /api/admin/instituicao com Idempotency-Key e Accept JSON', async () => {
    const key = 'instituicao-create-key';
    const promise = firstValueFrom(api.criar(criarCommand, withIdempotencyKey(key)));

    const req = controller.expectOne(`${BASE}/api/admin/instituicao`);
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

  it('atualizar() faz PUT /api/admin/instituicao/{id} com Idempotency-Key', async () => {
    const key = 'instituicao-update-key';
    const promise = firstValueFrom(api.atualizar(ID, atualizarCommand, withIdempotencyKey(key)));

    const req = controller.expectOne(`${BASE}/api/admin/instituicao/${ID}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('Idempotency-Key')).toBe(key);
    expect(req.request.body).toEqual(atualizarCommand);
    req.flush(null, { status: 204, statusText: 'No Content' });

    const result = (await promise) as ApiResult<void>;
    expect(isApiOk(result)).toBe(true);
  });

  it('remover() faz DELETE sem Idempotency-Key porque o backend não exige o header', async () => {
    const promise = firstValueFrom(api.remover(ID));

    const req = controller.expectOne(`${BASE}/api/admin/instituicao/${ID}`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.headers.has('Idempotency-Key')).toBe(false);
    req.flush(null, { status: 204, statusText: 'No Content' });

    const result = (await promise) as ApiResult<void>;
    expect(isApiOk(result)).toBe(true);
  });
});
