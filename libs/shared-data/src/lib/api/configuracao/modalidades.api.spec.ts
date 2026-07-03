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
  CriarModalidadeCommand,
  ModalidadeDto,
  ModalidadesApi,
} from './modalidades.api';
import { CONFIGURACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-0000000000a1';

const modalidadeSeed: ModalidadeDto = {
  id: ID,
  codigo: 'LB_PPI',
  descricao: 'Cota PPI baixa renda',
  naturezaLegal: 'COTA_RESERVADA',
  composicaoVagas: 'DENTRO_DO_VR',
  composicaoOrigem: null,
  regraRemanejamento: 'SEGUE_CASCATA',
  remanejamentoDestino: null,
  remanejamentoPar: null,
  remanejamentoFallback: null,
  criteriosCumulativos: ['escola pública', 'renda ≤ 1 SM'],
  acaoQuandoIndeferido: 'RECLASSIFICAR_AC',
  baseLegal: 'Lei 12.711/2012, art. 1º',
  criadoEm: '2026-07-03T12:00:00Z',
};

const criarCommand: CriarModalidadeCommand = {
  codigo: 'V',
  descricao: 'PcD ampla concorrência',
  naturezaLegal: 'SUPLEMENTAR',
  composicaoVagas: 'RETIRA_DE',
  composicaoOrigem: 'AC',
  regraRemanejamento: 'DESTINO_UNICO',
  remanejamentoDestino: 'AC',
  remanejamentoPar: null,
  remanejamentoFallback: null,
  criteriosCumulativos: ['laudo'],
  acaoQuandoIndeferido: 'RECLASSIFICAR_AC',
  baseLegal: 'Lei 14.723/2023',
};

describe('ModalidadesApi', () => {
  let api: ModalidadesApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(ModalidadesApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('listar() faz GET /api/configuracao/modalidades com limit e Accept versionado', async () => {
    const promise = firstValueFrom(api.listar({ limit: 50 }));
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/modalidades`);
    expect(req.request.params.get('limit')).toBe('50');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('modalidade', 1));
    req.flush([modalidadeSeed]);
    const result = (await promise) as ApiResult<readonly ModalidadeDto[]>;
    expect(isApiOk(result)).toBe(true);
  });

  it('listar() com cursor envia cursor + direction e omite limit', async () => {
    const promise = firstValueFrom(api.listar({ cursor: 'abc', direction: 'prev' }));
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/modalidades`);
    expect(req.request.params.get('cursor')).toBe('abc');
    expect(req.request.params.get('direction')).toBe('prev');
    expect(req.request.params.has('limit')).toBe(false);
    req.flush([modalidadeSeed]);
    await promise;
  });

  it('obter() faz GET /api/configuracao/modalidades/{id} com Accept versionado', async () => {
    const promise = firstValueFrom(api.obter(ID));
    const req = controller.expectOne(`${BASE}/api/configuracao/modalidades/${ID}`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('modalidade', 1));
    req.flush(modalidadeSeed);
    const result = (await promise) as ApiResult<ModalidadeDto>;
    expect(isApiOk(result)).toBe(true);
  });

  it('criar() faz POST /api/configuracao/admin/modalidades com Idempotency-Key e Accept JSON', async () => {
    const promise = firstValueFrom(api.criar(criarCommand, withIdempotencyKey('k')));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/modalidades`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.codigo).toBe('V');
    expect(req.request.body.composicaoOrigem).toBe('AC');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    req.flush(ID, { status: 201, statusText: 'Created' });
    const result = (await promise) as ApiResult<string>;
    expect(isApiOk(result)).toBe(true);
  });

  it('atualizar() faz PUT /api/configuracao/admin/modalidades/{id} sem enviar codigo (imutável)', async () => {
    const promise = firstValueFrom(
      api.atualizar(
        ID,
        {
          id: ID,
          descricao: 'Cota PPI baixa renda',
          naturezaLegal: 'COTA_RESERVADA',
          composicaoVagas: 'DENTRO_DO_VR',
          composicaoOrigem: null,
          regraRemanejamento: 'SEGUE_CASCATA',
          remanejamentoDestino: null,
          remanejamentoPar: null,
          remanejamentoFallback: null,
          criteriosCumulativos: ['escola pública'],
          acaoQuandoIndeferido: 'RECLASSIFICAR_AC',
          baseLegal: 'Lei 12.711/2012',
        },
        withIdempotencyKey('k'),
      ),
    );
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/modalidades/${ID}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.codigo).toBeUndefined();
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    req.flush(null, { status: 204, statusText: 'No Content' });
    const result = (await promise) as ApiResult<void>;
    expect(isApiOk(result)).toBe(true);
  });

  it('remover() faz DELETE /api/configuracao/admin/modalidades/{id} sem Idempotency-Key', async () => {
    const promise = firstValueFrom(api.remover(ID));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/modalidades/${ID}`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.headers.has('Idempotency-Key')).toBe(false);
    req.flush(null, { status: 204, statusText: 'No Content' });
    const result = (await promise) as ApiResult<void>;
    expect(isApiOk(result)).toBe(true);
  });

  it('remover() propaga 409 de bloqueio por referência como problem', async () => {
    const promise = firstValueFrom(api.remover(ID));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/modalidades/${ID}`);
    req.flush(
      {
        type: 'about:blank',
        title: 'Conflito',
        status: 409,
        code: 'Modalidade.RemocaoBloqueadaPorReferencia',
      },
      { status: 409, statusText: 'Conflict' },
    );
    const result = (await promise) as ApiResult<void>;
    expect(isApiOk(result)).toBe(false);
  });
});
