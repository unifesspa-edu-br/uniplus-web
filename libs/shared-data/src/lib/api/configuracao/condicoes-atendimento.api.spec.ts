import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ApiResult,
  apiResultInterceptor,
  buildVendorMimeAccept,
  isApiOk,
  withIdempotencyKey,
} from '@uniplus/shared-core/http';
import {
  AtualizarCondicaoAtendimentoCommand,
  CONFIGURACAO_BASE_PATH,
  CondicaoAtendimentoDto,
  CondicoesAtendimentoApi,
  CriarCondicaoAtendimentoCommand,
} from '@uniplus/shared-data/configuracao';

const BASE = 'http://localhost:5000';

const CONDICAO_ATENDIMENTO_ID = '019f41cf-69fd-759a-ac6d-09acabc1b027';

const condicaoAtendimentoSeed: CondicaoAtendimentoDto = {
  id: CONDICAO_ATENDIMENTO_ID,
  codigo: 'PCD',
  nome: 'Pcd',
  descricao: 'LBI (Lei 13.146/2015), art. 30',
  criadoEm: '2026-06-10T12:00:00Z',
};

const criarCommand: CriarCondicaoAtendimentoCommand = {
  codigo: 'PCD',
  nome: 'Pcd',
  descricao: 'LBI (Lei 13.146/2015), art. 30',
};

const atualizarCommand: AtualizarCondicaoAtendimentoCommand = {
  id: CONDICAO_ATENDIMENTO_ID,
  codigo: 'PCD',
  nome: 'Pessoa com Deficiência (PCD)',
  descricao: 'LBI (Lei 13.146/2015), art. 30',
};

describe('CondicoesAtendimentoApi', () => {
  let api: CondicoesAtendimentoApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(CondicoesAtendimentoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('listar() faz GET /api/configuracao/condicoes-atendimento com limit e Accept versionado', async () => {
    const promise = firstValueFrom(api.listar({ limit: 50 }));
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/condicoes-atendimento`);
    expect(req.request.params.get('limit')).toBe('50');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('condicao-atendimento', 1));
    req.flush([condicaoAtendimentoSeed]);
    const result = (await promise) as ApiResult<readonly CondicaoAtendimentoDto[]>;
    expect(isApiOk(result)).toBe(true);
  });

  it('listar() com cursor envia cursor + direction e omite limit', async () => {
    const promise = firstValueFrom(api.listar({ cursor: 'abc', direction: 'prev' }));
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/condicoes-atendimento`);
    expect(req.request.params.get('cursor')).toBe('abc');
    expect(req.request.params.get('direction')).toBe('prev');
    expect(req.request.params.has('limit')).toBe(false);
    req.flush([condicaoAtendimentoSeed]);
    await promise;
  });

  it('criar() faz POST /api/configuracao/admin/condicoes-atendimento com Idempotency-Key e Accept JSON', async () => {
    const promise = firstValueFrom(api.criar(criarCommand, withIdempotencyKey('k')));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/condicoes-atendimento`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    req.flush(CONDICAO_ATENDIMENTO_ID, { status: 201, statusText: 'Created' });
    const result = (await promise) as ApiResult<string>;
    expect(isApiOk(result)).toBe(true);
  });

  it('atualizar() faz PUT /api/configuracao/admin/condicoes-atendimento com Idempotency-Key', async () => {
    const promise = firstValueFrom(api.atualizar(atualizarCommand.id, atualizarCommand, withIdempotencyKey('k')));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/condicoes-atendimento/${CONDICAO_ATENDIMENTO_ID}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    req.flush(CONDICAO_ATENDIMENTO_ID, { status: 204, statusText: 'No Content' });
    const result = (await promise) as ApiResult<string>;
    expect(isApiOk(result)).toBe(true);
  });

  it('obter() faz GET /api/configuracao/admin/condicoes-atendimento/{id}>', async () => {
    const promise = firstValueFrom(api.obter(CONDICAO_ATENDIMENTO_ID));
    const req = controller.expectOne(`${BASE}/api/configuracao/condicoes-atendimento/${CONDICAO_ATENDIMENTO_ID}`);
    expect(req.request.method).toBe('GET');
    req.flush(CONDICAO_ATENDIMENTO_ID, { status: 200, statusText: 'Ok' });
    const result = (await promise) as ApiResult<string>;
    expect(isApiOk(result)).toBe(true);
  });

  it('remover() faz DELETE /api/configuracao/admin/condicoes-atendimento/{id}', async () => {
    const promise = firstValueFrom(api.remover(CONDICAO_ATENDIMENTO_ID));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/condicoes-atendimento/${CONDICAO_ATENDIMENTO_ID}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    const result = (await promise) as ApiResult<void>;
    expect(isApiOk(result)).toBe(true);
  });
});
