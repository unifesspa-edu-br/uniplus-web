import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { RevisoesApi } from './revisoes.api';
import { AUTORIZACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const RAIZ = `${BASE}/api/autorizacao/revisoes`;
const ID = '01960000-0000-7000-0000-0000000000a1';
const ITEM = '01960000-0000-7000-0000-0000000000b1';
const MIME = 'application/vnd.uniplus.revisao-de-acessos.v1+json';

describe('RevisoesApi', () => {
  let api: RevisoesApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: AUTORIZACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(RevisoesApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('lista a primeira página pelo limite, no tipo de mídia da revisão', () => {
    void firstValueFrom(api.listar());
    const req = controller.expectOne((r) => r.url === RAIZ);
    expect(req.request.params.get('limit')).toBe('50');
    expect(req.request.headers.get('Accept')).toContain(MIME);
    req.flush([]);
  });

  it('segue o cursor da página pedida', () => {
    void firstValueFrom(api.listar({ cursor: 'c1', direction: 'prev' }));
    const req = controller.expectOne((r) => r.url === RAIZ);
    expect(req.request.params.get('cursor')).toBe('c1');
    expect(req.request.params.get('direction')).toBe('prev');
    req.flush([]);
  });

  it('lê o detalhe pelo id', () => {
    void firstValueFrom(api.obter(ID));
    const req = controller.expectOne(`${RAIZ}/${ID}`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toContain(MIME);
    req.flush({});
  });

  it('abre a revisão sem corpo, com chave de idempotência', () => {
    void firstValueFrom(api.abrir(withIdempotencyKey('k')));
    const req = controller.expectOne(RAIZ);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    req.flush({}, { status: 201, statusText: 'Created' });
  });

  it('confirma o item sem corpo, com chave de idempotência', () => {
    void firstValueFrom(api.confirmar(ID, ITEM, withIdempotencyKey('k')));
    const req = controller.expectOne(`${RAIZ}/${ID}/itens/${ITEM}/confirmacao`);
    expect(req.request.body).toBeNull();
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('revoga o item com o motivo e chave de idempotência', () => {
    void firstValueFrom(api.revogar(ID, ITEM, { motivo: 'Mudou de setor.' }, withIdempotencyKey('k')));
    const req = controller.expectOne(`${RAIZ}/${ID}/itens/${ITEM}/revogacao`);
    expect(req.request.body).toEqual({ motivo: 'Mudou de setor.' });
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});
