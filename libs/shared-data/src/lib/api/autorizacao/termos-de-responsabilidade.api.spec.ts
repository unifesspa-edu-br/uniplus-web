import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { PedidosDeConcessaoApi } from './pedidos-de-concessao.api';
import { TermosDeResponsabilidadeApi } from './termos-de-responsabilidade.api';
import { AUTORIZACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const RAIZ = `${BASE}/api/autorizacao/termos-de-responsabilidade`;
const MIME = 'application/vnd.uniplus.versao-do-termo.v1+json';

describe('TermosDeResponsabilidadeApi', () => {
  let api: TermosDeResponsabilidadeApi;
  let pedidos: PedidosDeConcessaoApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: AUTORIZACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(TermosDeResponsabilidadeApi);
    pedidos = TestBed.inject(PedidosDeConcessaoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('lê a vigente', () => {
    void firstValueFrom(api.vigente());
    const req = controller.expectOne(`${RAIZ}/vigente`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toContain(MIME);
  });

  it('lê a versão fixada pelo id', () => {
    void firstValueFrom(api.versao('v/1'));
    const req = controller.expectOne(`${RAIZ}/versoes/v%2F1`);
    expect(req.request.headers.get('Accept')).toContain(MIME);
    req.flush({});
  });

  it('lê o histórico pela primeira página', () => {
    void firstValueFrom(api.historico());
    const req = controller.expectOne((r) => r.url === `${RAIZ}/versoes`);
    expect(req.request.params.get('limit')).toBe('50');
    expect(req.request.headers.get('Accept')).toContain(MIME);
    req.flush([]);
  });

  it('publica com a vigente esperada e a chave de idempotência', () => {
    const corpo = { texto: 'Texto.', ato: 'Portaria 1/2026', versaoVigenteEsperadaId: null };
    void firstValueFrom(api.publicar(corpo, withIdempotencyKey('k')));
    const req = controller.expectOne(`${RAIZ}/versoes`);
    expect(req.request.body).toEqual(corpo);
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    req.flush({}, { status: 201, statusText: 'Created' });
  });

  it('o aceite do pedido com termo informa a versão fixada; sem termo, vai sem corpo', () => {
    void firstValueFrom(pedidos.aceitar('p1', withIdempotencyKey('k'), 'v2'));
    void firstValueFrom(pedidos.aceitar('p2', withIdempotencyKey('k')));
    const raiz = `${BASE}/api/autorizacao/pedidos-de-concessao`;
    expect(controller.expectOne(`${raiz}/p1/aceite`).request.body).toEqual({
      termoVersaoApresentadaId: 'v2',
    });
    expect(controller.expectOne(`${raiz}/p2/aceite`).request.body).toBeNull();
  });
});
