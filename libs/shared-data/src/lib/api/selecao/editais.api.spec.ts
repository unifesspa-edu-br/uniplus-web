import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ApiResult,
  apiResultInterceptor,
  buildVendorMimeAccept,
  isApiOk,
} from '@uniplus/shared-core';
import { EditaisApi, EditalDto } from './editais.api';
import { SELECAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';

const editalSeed: EditalDto = {
  id: '01960000-0000-7000-0000-000000000001',
  numeroEdital: '042/2026',
  titulo: 'PSE 2026',
  tipoProcesso: 'PSE',
  status: 'Rascunho',
  maximoOpcoesCurso: 2,
  bonusRegionalHabilitado: true,
  criadoEm: '2026-04-15T12:00:00Z',
};

describe('EditaisApi', () => {
  let api: EditaisApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(EditaisApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('listar() faz GET /api/editais com vendor MIME v1 e devolve ApiResult.ok com a lista', async () => {
    const promise = firstValueFrom(api.listar());

    const req = controller.expectOne(`${BASE}/api/editais`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('edital', 1));
    req.flush([editalSeed]);

    const result = (await promise) as ApiResult<readonly EditalDto[]>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].numeroEdital).toBe('042/2026');
    }
  });

  it('obter() faz GET /api/editais/{id} com encoding seguro do path param', async () => {
    const id = 'edt with space/01';

    const promise = firstValueFrom(api.obter(id));

    const req = controller.expectOne(`${BASE}/api/editais/${encodeURIComponent(id)}`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('edital', 1));
    req.flush(editalSeed);

    const result = (await promise) as ApiResult<EditalDto>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe(editalSeed.id);
    }
  });

  it('obter() entrega ApiFailure quando o backend devolve 404 problem+json', async () => {
    const promise = firstValueFrom(api.obter('inexistente'));

    controller.expectOne(`${BASE}/api/editais/inexistente`).flush(
      {
        type: 'https://uniplus.unifesspa.edu.br/errors/uniplus.selecao.edital.nao_encontrado',
        title: 'Edital não encontrado',
        status: 404,
        code: 'uniplus.selecao.edital.nao_encontrado',
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      },
      { status: 404, statusText: 'Not Found', headers: { 'Content-Type': 'application/problem+json' } },
    );

    const result = (await promise) as ApiResult<EditalDto>;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem.code).toBe('uniplus.selecao.edital.nao_encontrado');
      expect(result.status).toBe(404);
    }
  });
});
