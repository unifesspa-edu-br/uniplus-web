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
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  TermosConsentimentoApi,
  type CriarTermoConsentimentoCommand,
  type EditarRascunhoTermoConsentimentoCommand,
  type TermoConsentimentoDto,
  type TermoConsentimentoResumoDto,
} from './termos-consentimento.api';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-0000000000a1';

const termoResumoSeed: TermoConsentimentoResumoDto = {
  id: ID,
  nome: 'Termo de Privacidade LGPD',
  formaAceiteRascunho: 'REGISTRO_DIGITAL_COM_LOG_IP',
  revisado: true,
  criadoEm: '2026-08-13T10:00:00Z',
};

const termoDtoSeed: TermoConsentimentoDto = {
  id: ID,
  nome: 'Termo de Privacidade LGPD',
  formaAceiteRascunho: 'REGISTRO_DIGITAL_COM_LOG_IP',
  textoRascunho: 'Conteúdo detalhado do termo...',
  baseLegalRascunho: null,
  revisado: true,
  revisadoEm: '2026-08-13T10:00:00Z',
  criadoEm: '2026-08-13T10:00:00Z',
  versoes: [],
};

const criarCommand: CriarTermoConsentimentoCommand = {
  nome: 'Novo Termo de Consentimento',
  formaAceiteRascunho: 'REGISTRO_DIGITAL_COM_LOG_IP',
  textoRascunho: 'Texto inicial do rascunho',
  baseLegalRascunho: null,
};

const editarCommand: EditarRascunhoTermoConsentimentoCommand = {
  id: ID,
  formaAceiteRascunho: 'REGISTRO_DIGITAL_SEM_LOG_IP',
  textoRascunho: 'Texto do rascunho atualizado',
  baseLegalRascunho: null,
};

describe('TermosConsentimentoApi', () => {
  let api: TermosConsentimentoApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        TermosConsentimentoApi,
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(TermosConsentimentoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('listar() faz GET /api/configuracao/termos-consentimento com limit e Accept versionado', async () => {
    const promise = firstValueFrom(api.listar({ limit: 50 }));
    const req = controller.expectOne(
      (r) => r.url === `${BASE}/api/configuracao/termos-consentimento`,
    );
    expect(req.request.params.get('limit')).toBe('50');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('termo-consentimento', 1));
    req.flush([termoResumoSeed]);
    const result = (await promise) as ApiResult<readonly TermoConsentimentoResumoDto[]>;
    expect(isApiOk(result)).toBe(true);
  });

  it('listar() com cursor envia cursor + direction e omite limit', async () => {
    const promise = firstValueFrom(api.listar({ cursor: 'abc', direction: 'prev' }));
    const req = controller.expectOne(
      (r) => r.url === `${BASE}/api/configuracao/termos-consentimento`,
    );
    expect(req.request.params.get('cursor')).toBe('abc');
    expect(req.request.params.get('direction')).toBe('prev');
    expect(req.request.params.has('limit')).toBe(false);
    req.flush([termoResumoSeed]);
    await promise;
  });

  it('listar() normaliza q e o preserva com o cursor', async () => {
    const promise = firstValueFrom(
      api.listar({ cursor: 'abc', direction: 'next', q: '  privacidade  ' }),
    );
    const req = controller.expectOne(
      (r) => r.url === `${BASE}/api/configuracao/termos-consentimento`,
    );
    expect(req.request.params.get('q')).toBe('privacidade');
    expect(req.request.params.get('cursor')).toBe('abc');
    expect(req.request.params.get('direction')).toBe('next');
    expect(req.request.params.has('limit')).toBe(false);
    req.flush([termoResumoSeed]);
    await promise;
  });

  it('obter() faz GET /api/configuracao/termos-consentimento/{id} com Accept versionado', async () => {
    const promise = firstValueFrom(api.obter(ID));
    const req = controller.expectOne(`${BASE}/api/configuracao/termos-consentimento/${ID}`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('termo-consentimento', 1));
    req.flush(termoDtoSeed);
    const result = (await promise) as ApiResult<TermoConsentimentoDto>;
    expect(isApiOk(result)).toBe(true);
  });

  it('criar() faz POST /api/configuracao/admin/termos-consentimento com Idempotency-Key e Accept JSON', async () => {
    const promise = firstValueFrom(api.criar(criarCommand, withIdempotencyKey('k')));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/termos-consentimento`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.nome).toBe('Novo Termo de Consentimento');
    expect(req.request.body.formaAceiteRascunho).toBe('REGISTRO_DIGITAL_COM_LOG_IP');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    req.flush(ID, { status: 201, statusText: 'Created' });
    const result = (await promise) as ApiResult<string>;
    expect(isApiOk(result)).toBe(true);
  });

  it('editarRascunho() faz PUT /api/configuracao/admin/termos-consentimento/{id}/rascunho com Idempotency-Key', async () => {
    const promise = firstValueFrom(api.editarRascunho(ID, editarCommand, withIdempotencyKey('k')));
    const req = controller.expectOne(
      `${BASE}/api/configuracao/admin/termos-consentimento/${ID}/rascunho`,
    );
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.formaAceiteRascunho).toBe('REGISTRO_DIGITAL_SEM_LOG_IP');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    req.flush(null, { status: 204, statusText: 'No Content' });
    const result = (await promise) as ApiResult<void>;
    expect(isApiOk(result)).toBe(true);
  });

  it('revisar() faz POST /api/configuracao/admin/termos-consentimento/{id}/revisar com Idempotency-Key', async () => {
    const promise = firstValueFrom(api.revisar(ID, withIdempotencyKey('k')));
    const req = controller.expectOne(
      `${BASE}/api/configuracao/admin/termos-consentimento/${ID}/revisar`,
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    req.flush(null, { status: 204, statusText: 'No Content' });
    const result = (await promise) as ApiResult<void>;
    expect(isApiOk(result)).toBe(true);
  });

  it('promover() faz POST /api/configuracao/admin/termos-consentimento/{id}/promover com Idempotency-Key', async () => {
    const promise = firstValueFrom(api.promover(ID, withIdempotencyKey('k')));
    const req = controller.expectOne(
      `${BASE}/api/configuracao/admin/termos-consentimento/${ID}/promover`,
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    req.flush(null, { status: 204, statusText: 'No Content' });
    const result = (await promise) as ApiResult<void>;
    expect(isApiOk(result)).toBe(true);
  });

  it('remover() faz DELETE /api/configuracao/admin/termos-consentimento/{id} sem Idempotency-Key', async () => {
    const promise = firstValueFrom(api.remover(ID));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/termos-consentimento/${ID}`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.headers.has('Idempotency-Key')).toBe(false);
    req.flush(null, { status: 204, statusText: 'No Content' });
    const result = (await promise) as ApiResult<void>;
    expect(isApiOk(result)).toBe(true);
  });

  it('remover() propaga 409 de bloqueio por referencia como problem', async () => {
    const promise = firstValueFrom(api.remover(ID));
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/termos-consentimento/${ID}`);
    req.flush(
      {
        type: 'about:blank',
        title: 'Conflito',
        status: 409,
        code: 'TermoConsentimento.RemocaoBloqueadaPorReferencia',
      },
      { status: 409, statusText: 'Conflict' },
    );
    const result = (await promise) as ApiResult<void>;
    expect(isApiOk(result)).toBe(false);
  });
});
