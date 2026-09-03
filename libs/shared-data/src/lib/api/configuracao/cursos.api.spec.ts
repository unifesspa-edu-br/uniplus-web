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
import { CriarCursoCommand, CursoDto, CursosApi } from './cursos.api';
import { CONFIGURACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-0000000000c1';

const cursoSeed: CursoDto = {
  id: ID,
  codigo: 'ENG-CIV',
  nome: 'Engenharia Civil',
  grau: 'Bacharelado',
  nivelEnsino: 'Graduação',
  grupoAreaEnem: 'Tecnológica',
  criadoEm: '2026-06-10T12:00:00Z',
};

const criarCommand: CriarCursoCommand = {
  codigo: 'ENG-CIV',
  nome: 'Engenharia Civil',
  grau: 'Bacharelado',
  nivelEnsino: 'Graduação',
  grupoAreaEnem: 'Tecnológica',
};

describe('CursosApi', () => {
  let api: CursosApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(CursosApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('listar() faz GET /api/configuracao/cursos com limit e Accept versionado', async () => {
    const promise = firstValueFrom(api.listar({ limit: 50 }));
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/cursos`);
    expect(req.request.params.get('limit')).toBe('50');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('curso', 1));
    req.flush([cursoSeed]);
    const result = (await promise) as ApiResult<readonly CursoDto[]>;
    expect(isApiOk(result)).toBe(true);
  });

  it('listar() com cursor envia cursor + direction e omite limit', async () => {
    const promise = firstValueFrom(api.listar({ cursor: 'abc', direction: 'prev' }));
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/cursos`);
    expect(req.request.params.get('cursor')).toBe('abc');
    expect(req.request.params.get('direction')).toBe('prev');
    expect(req.request.params.has('limit')).toBe(false);
    req.flush([cursoSeed]);
    await promise;
  });

  it('listar() na primeira página envia ordenarPor + ordem quando informados', async () => {
    const promise = firstValueFrom(api.listar({ limit: 25, ordenarPor: 'nome', ordem: 'desc' }));
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/cursos`);
    expect(req.request.params.get('ordenarPor')).toBe('nome');
    expect(req.request.params.get('ordem')).toBe('desc');
    req.flush([cursoSeed]);
    await promise;
  });

  it('listar() com cursor omite ordenarPor/ordem (o cursor carrega a ordem)', async () => {
    const promise = firstValueFrom(
      api.listar({ cursor: 'abc', direction: 'next', ordenarPor: 'nome', ordem: 'asc' }),
    );
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/cursos`);
    expect(req.request.params.has('ordenarPor')).toBe(false);
    expect(req.request.params.has('ordem')).toBe(false);
    req.flush([cursoSeed]);
    await promise;
  });

  it('listar() envia q (trim) em toda página — inclusive na navegação por cursor', async () => {
    const pagina1 = firstValueFrom(api.listar({ limit: 25, q: '  eng  ' }));
    const r1 = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/cursos`);
    expect(r1.request.params.get('q')).toBe('eng');
    r1.flush([cursoSeed]);
    await pagina1;

    const pagina2 = firstValueFrom(api.listar({ cursor: 'abc', direction: 'next', q: 'eng' }));
    const r2 = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/cursos`);
    expect(r2.request.params.get('q')).toBe('eng');
    expect(r2.request.params.get('cursor')).toBe('abc');
    r2.flush([cursoSeed]);
    await pagina2;
  });

  it('obter() faz GET /api/configuracao/cursos/{id}', async () => {
    const promise = firstValueFrom(api.obter(ID));
    const req = controller.expectOne(`${BASE}/api/configuracao/cursos/${ID}`);
    expect(req.request.method).toBe('GET');
    req.flush(cursoSeed);
    const result = (await promise) as ApiResult<CursoDto>;
    expect(isApiOk(result)).toBe(true);
  });

  it('criar() faz POST /api/configuracao/admin/cursos com Idempotency-Key e Accept JSON', async () => {
    const promise = firstValueFrom(api.criar(criarCommand, withIdempotencyKey('k')));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/cursos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    req.flush(ID, { status: 201, statusText: 'Created' });
    const result = (await promise) as ApiResult<string>;
    expect(isApiOk(result)).toBe(true);
  });

  it('atualizar() faz PUT /api/configuracao/admin/cursos/{id}', async () => {
    const promise = firstValueFrom(
      api.atualizar(ID, { id: ID, ...criarCommand }, withIdempotencyKey('k')),
    );
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/cursos/${ID}`);
    expect(req.request.method).toBe('PUT');
    req.flush(null, { status: 204, statusText: 'No Content' });
    const result = (await promise) as ApiResult<void>;
    expect(isApiOk(result)).toBe(true);
  });

  it('remover() faz DELETE /api/configuracao/admin/cursos/{id}', async () => {
    const promise = firstValueFrom(api.remover(ID));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/cursos/${ID}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    const result = (await promise) as ApiResult<void>;
    expect(isApiOk(result)).toBe(true);
  });
});
