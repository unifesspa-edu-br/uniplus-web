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
  CONFIGURACAO_BASE_PATH,
  RecursoAcessibilidadeDto,
  CriarRecursoAcessibilidadeCommand,
  AtualizarRecursoAcessibilidadeCommand,
  RecursoAcessibilidadeApi,
} from '@uniplus/shared-data/configuracao';

const BASE = 'http://localhost:5000';

const RECURSO_ACESSIBILIDADE_ID = '019f41cf-69fd-759a-ac6d-09acabc1b027';

const recursoAcessibilidadeSeed: RecursoAcessibilidadeDto = {
  id: RECURSO_ACESSIBILIDADE_ID,
  nome: 'Ledor',
  descricao: 'Leitura da prova em voz alta por fiscal designado.',
  criadoEm: '2026-06-10T12:00:00Z',
};

const criarCommand: CriarRecursoAcessibilidadeCommand = {
  nome: 'Ledor',
  descricao: 'Leitura da prova em voz alta por fiscal designado.',
};

const atualizarCommand: AtualizarRecursoAcessibilidadeCommand = {
  id: RECURSO_ACESSIBILIDADE_ID,
  nome: 'Ledor de Prova',
  descricao: 'Leitura da prova em voz alta por fiscal designado.',
};

describe('RecursoAcessibilidadeApi', () => {
  let api: RecursoAcessibilidadeApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(RecursoAcessibilidadeApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('listar() faz GET /api/configuracao/recursos-acessibilidade com limit e Accept versionado', async () => {
    const promise = firstValueFrom(api.listar({ limit: 50 }));
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/recursos-acessibilidade`);
    expect(req.request.params.get('limit')).toBe('50');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('recurso-acessibilidade', 1));
    req.flush([recursoAcessibilidadeSeed]);
    const result = (await promise) as ApiResult<readonly RecursoAcessibilidadeDto[]>;
    expect(isApiOk(result)).toBe(true);
  });

  it('criar() faz POST /api/configuracao/admin/recursos-acessibilidade com Idempotency-Key e Accept JSON', async () => {
    const promise = firstValueFrom(api.criar(criarCommand, withIdempotencyKey('k')));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/recursos-acessibilidade`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    req.flush(RECURSO_ACESSIBILIDADE_ID, { status: 201, statusText: 'Created' });
    const result = (await promise) as ApiResult<string>;
    expect(isApiOk(result)).toBe(true);
  });

  it('atualizar() faz PUT /api/configuracao/admin/recursos-acessibilidade com Idempotency-Key', async () => {
    const promise = firstValueFrom(api.atualizar(atualizarCommand.id, atualizarCommand, withIdempotencyKey('k')));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/recursos-acessibilidade/${RECURSO_ACESSIBILIDADE_ID}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    req.flush(RECURSO_ACESSIBILIDADE_ID, { status: 204, statusText: 'No Content' });
    const result = (await promise) as ApiResult<string>;
    expect(isApiOk(result)).toBe(true);
  });

  it('remover() faz DELETE /api/configuracao/admin/recursos-acessibilidade/{id} — soft-delete', async () => {
    const promise = firstValueFrom(api.remover(RECURSO_ACESSIBILIDADE_ID));
    const req = controller.expectOne((`${BASE}/api/configuracao/admin/recursos-acessibilidade/${RECURSO_ACESSIBILIDADE_ID}`));
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    const result = (await promise) as ApiResult<void>;
    expect(isApiOk(result)).toBe(true);
  });
});
