import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ApiResult,
  apiResultInterceptor,
  buildVendorMimeAccept,
  isApiOk,
} from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  CategoriaDocumentoDto,
  CategoriasDocumentoApi,
} from '@uniplus/shared-data/configuracao';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const BASE = 'http://localhost:5000';

const identificacao: CategoriaDocumentoDto = {
  id: 'ca7e0000-0000-7000-8000-000000000001',
  codigo: 'IDENTIFICACAO',
  nome: 'Identificação',
  descricao: null,
  ordem: 1,
  criadoEm: '2026-01-01T00:00:00Z',
};

describe('CategoriasDocumentoApi', () => {
  let api: CategoriasDocumentoApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(CategoriasDocumentoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('listar() faz GET /api/configuracao/categorias-documento com Accept versionado', async () => {
    const promise = firstValueFrom(api.listar());
    const req = controller.expectOne(
      (r) => r.url === `${BASE}/api/configuracao/categorias-documento`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('categoria-documento', 1));
    req.flush([identificacao]);
    const result = (await promise) as ApiResult<readonly CategoriaDocumentoDto[]>;
    expect(isApiOk(result)).toBe(true);
    expect(result.ok && result.data[0].codigo).toBe('IDENTIFICACAO');
  });

  // O recurso não é paginado: mandar `limit`/`cursor` sugeriria uma janela que
  // o backend não implementa e faria a tela acreditar que existe página seguinte.
  it('listar() não envia parâmetro de paginação', async () => {
    const promise = firstValueFrom(api.listar());
    const req = controller.expectOne(
      (r) => r.url === `${BASE}/api/configuracao/categorias-documento`,
    );
    expect(req.request.params.keys()).toEqual([]);
    req.flush([identificacao]);
    await promise;
  });

  it('listar() devolve a recusa envelopada em vez de lançar', async () => {
    const promise = firstValueFrom(api.listar());
    const req = controller.expectOne(
      (r) => r.url === `${BASE}/api/configuracao/categorias-documento`,
    );
    req.flush(
      { type: 'about:blank', title: 'Serviço indisponível', status: 503 },
      { status: 503, statusText: 'Service Unavailable' },
    );
    const result = (await promise) as ApiResult<readonly CategoriaDocumentoDto[]>;
    expect(isApiOk(result)).toBe(false);
  });
});
