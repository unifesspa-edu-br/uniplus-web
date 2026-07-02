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
import { CriarOfertaCursoCommand, OfertaCursoDto, OfertasCursoApi } from './ofertas-curso.api';
import { CONFIGURACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-0000000000d1';
const CURSO_ID = '01960000-0000-7000-0000-0000000000c1';
const LOCAL_ID = '01960000-0000-7000-0000-0000000000e1';
const UNIDADE_ID = '01960000-0000-7000-0000-0000000000f1';

const ofertaSeed: OfertaCursoDto = {
  id: ID,
  cursoId: CURSO_ID,
  localOfertaId: LOCAL_ID,
  unidadeOfertante: { origemId: UNIDADE_ID, sigla: 'IGE', nome: 'Instituto de Geociências e Engenharias', tipo: 'Instituto' },
  programaDeOferta: 'REGULAR',
  formatoPedagogico: 'PRESENCIAL',
  turno: 'MATUTINO',
  eMecCodigo: '123456',
  codigoSga: null,
  vagasAnuaisAutorizadas: 40,
  baseLegal: null,
  atoAutorizacaoMec: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

const criarCommand: CriarOfertaCursoCommand = {
  cursoId: CURSO_ID,
  localOfertaId: LOCAL_ID,
  unidadeOfertanteOrigemId: UNIDADE_ID,
  programaDeOferta: 'REGULAR',
  formatoPedagogico: 'PRESENCIAL',
  turno: 'MATUTINO',
  eMecCodigo: '123456',
  vagasAnuaisAutorizadas: 40,
};

describe('OfertasCursoApi', () => {
  let api: OfertasCursoApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(OfertasCursoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('listar() faz GET /api/configuracao/ofertas-curso com limit e Accept versionado', async () => {
    const promise = firstValueFrom(api.listar({ limit: 50 }));
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/ofertas-curso`);
    expect(req.request.params.get('limit')).toBe('50');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('oferta-curso', 1));
    req.flush([ofertaSeed]);
    const result = (await promise) as ApiResult<readonly OfertaCursoDto[]>;
    expect(isApiOk(result)).toBe(true);
  });

  it('listar() com cursor envia cursor + direction e omite limit', async () => {
    const promise = firstValueFrom(api.listar({ cursor: 'abc', direction: 'prev' }));
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/ofertas-curso`);
    expect(req.request.params.get('cursor')).toBe('abc');
    expect(req.request.params.get('direction')).toBe('prev');
    expect(req.request.params.has('limit')).toBe(false);
    req.flush([ofertaSeed]);
    await promise;
  });

  it('obter() faz GET /api/configuracao/ofertas-curso/{id}', async () => {
    const promise = firstValueFrom(api.obter(ID));
    const req = controller.expectOne(`${BASE}/api/configuracao/ofertas-curso/${ID}`);
    expect(req.request.method).toBe('GET');
    req.flush(ofertaSeed);
    const result = (await promise) as ApiResult<OfertaCursoDto>;
    expect(isApiOk(result)).toBe(true);
  });

  it('criar() envia unidadeOfertanteOrigemId (não unidadeOfertanteId) com Idempotency-Key', async () => {
    const promise = firstValueFrom(api.criar(criarCommand, withIdempotencyKey('k')));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/ofertas-curso`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.unidadeOfertanteOrigemId).toBe(UNIDADE_ID);
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    req.flush(ID, { status: 201, statusText: 'Created' });
    const result = (await promise) as ApiResult<string>;
    expect(isApiOk(result)).toBe(true);
  });

  it('atualizar() não envia cursoId/localOfertaId/unidadeOfertanteOrigemId (imutáveis pós-criação)', async () => {
    const promise = firstValueFrom(
      api.atualizar(
        ID,
        {
          id: ID,
          programaDeOferta: 'REGULAR',
          formatoPedagogico: 'PRESENCIAL',
          turno: 'MATUTINO',
          eMecCodigo: '123456',
          vagasAnuaisAutorizadas: 40,
        },
        withIdempotencyKey('k'),
      ),
    );
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/ofertas-curso/${ID}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.cursoId).toBeUndefined();
    expect(req.request.body.localOfertaId).toBeUndefined();
    expect(req.request.body.unidadeOfertanteOrigemId).toBeUndefined();
    req.flush(null, { status: 204, statusText: 'No Content' });
    const result = (await promise) as ApiResult<void>;
    expect(isApiOk(result)).toBe(true);
  });

  it('remover() faz DELETE /api/configuracao/admin/ofertas-curso/{id}', async () => {
    const promise = firstValueFrom(api.remover(ID));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/ofertas-curso/${ID}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    const result = (await promise) as ApiResult<void>;
    expect(isApiOk(result)).toBe(true);
  });
});
