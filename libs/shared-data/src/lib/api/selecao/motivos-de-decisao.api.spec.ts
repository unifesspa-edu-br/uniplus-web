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
import {
  CriarMotivoDeDecisaoCommand,
  MotivoDeDecisaoDto,
  MotivosDeDecisaoApi,
} from './motivos-de-decisao.api';
import { SELECAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const LISTA = `${BASE}/api/selecao/motivos-de-decisao`;
const ESCRITA = `${BASE}/api/selecao/admin/motivos-de-decisao`;
const ID = '01960000-0000-7000-0000-0000000000a1';

const motivo: MotivoDeDecisaoDto = {
  id: ID,
  tipo: 'HOMOLOGACAO_DAS_INSCRICOES',
  codigo: 'SEM_RESULTADO_NO_ENEM',
  descricao: 'Sem resultado no ENEM informado.',
  subclassificacao: null,
  sentido: 'DESFAVORAVEL',
  ativo: true,
};

const criacao: CriarMotivoDeDecisaoCommand = {
  tipo: 'HOMOLOGACAO_DAS_INSCRICOES',
  codigo: 'SEM_RESULTADO_NO_ENEM',
  descricao: 'Sem resultado no ENEM informado.',
  subclassificacao: null,
  sentido: 'DESFAVORAVEL',
};

describe('MotivosDeDecisaoApi', () => {
  let api: MotivosDeDecisaoApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(MotivosDeDecisaoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('listar() envia o tipo, os desativados e o limite, com o Accept versionado', async () => {
    const promise = firstValueFrom(
      api.listar({ tipo: 'HOMOLOGACAO_DAS_INSCRICOES', apenasAtivos: false, limit: 50 }),
    );
    const req = controller.expectOne((r) => r.url === LISTA);
    expect(req.request.params.get('tipo')).toBe('HOMOLOGACAO_DAS_INSCRICOES');
    expect(req.request.params.get('apenasAtivos')).toBe('false');
    expect(req.request.params.get('limit')).toBe('50');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('motivo-de-decisao', 1));
    req.flush([motivo]);
    expect(isApiOk((await promise) as ApiResult<readonly MotivoDeDecisaoDto[]>)).toBe(true);
  });

  it('listar() sem filtro pede só o limite padrão', async () => {
    const promise = firstValueFrom(api.listar());
    const req = controller.expectOne((r) => r.url === LISTA);
    expect(req.request.params.has('tipo')).toBe(false);
    expect(req.request.params.has('apenasAtivos')).toBe(false);
    expect(req.request.params.get('limit')).toBe('100');
    req.flush([]);
    await promise;
  });

  it('listar() com cursor envia cursor e direção e omite o limite, mantendo o filtro', async () => {
    const promise = firstValueFrom(
      api.listar({ tipo: 'CLASSIFICACAO', cursor: 'abc', direction: 'prev' }),
    );
    const req = controller.expectOne((r) => r.url === LISTA);
    expect(req.request.params.get('tipo')).toBe('CLASSIFICACAO');
    expect(req.request.params.get('cursor')).toBe('abc');
    expect(req.request.params.get('direction')).toBe('prev');
    expect(req.request.params.has('limit')).toBe(false);
    req.flush([]);
    await promise;
  });

  it('criar() faz POST com Idempotency-Key e Accept JSON', async () => {
    const promise = firstValueFrom(api.criar(criacao, withIdempotencyKey('k')));
    const req = controller.expectOne(ESCRITA);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    expect(req.request.body).toEqual(criacao);
    req.flush(ID, { status: 201, statusText: 'Created' });
    expect(isApiOk((await promise) as ApiResult<string>)).toBe(true);
  });

  it('atualizar() faz PUT só com id e descrição', async () => {
    const promise = firstValueFrom(
      api.atualizar(ID, { id: ID, descricao: 'Nova descrição.' }, withIdempotencyKey('k')),
    );
    const req = controller.expectOne(`${ESCRITA}/${ID}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    expect(req.request.body).toEqual({ id: ID, descricao: 'Nova descrição.' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(isApiOk((await promise) as ApiResult<void>)).toBe(true);
  });

  it('desativar() faz DELETE na ativação, com Idempotency-Key', async () => {
    const promise = firstValueFrom(api.desativar(ID, withIdempotencyKey('k')));
    const req = controller.expectOne(`${ESCRITA}/${ID}/ativacao`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(isApiOk((await promise) as ApiResult<void>)).toBe(true);
  });

  it('reativar() faz POST na ativação, com Idempotency-Key', async () => {
    const promise = firstValueFrom(api.reativar(ID, withIdempotencyKey('k')));
    const req = controller.expectOne(`${ESCRITA}/${ID}/ativacao`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(isApiOk((await promise) as ApiResult<void>)).toBe(true);
  });
});
