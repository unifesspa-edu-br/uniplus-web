import { HttpContext } from '@angular/common/http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiResult } from './api-result';
import { AmbienteHttp, Edital, prepararAmbienteHttp } from './api-result.interceptor.testing';
import { IDEMPOTENCY_KEY_TOKEN, idempotencyKey, withIdempotencyKey } from './idempotency';
import { withVendorMime } from './vendor-mime';

describe('apiResultInterceptor', () => {
  let ambiente: AmbienteHttp;

  beforeEach(() => {
    ambiente = prepararAmbienteHttp();
  });

  afterEach(() => {
    ambiente.controller.verify();
  });

  describe('vendor MIME injection (ADR-0028)', () => {
    it('quando withVendorMime é usado, request anexa Accept correto', () => {
      ambiente.http
        .get<ApiResult<Edital>>('/api/selecao/editais/edt-1', {
          context: withVendorMime('edital', 1),
        })
        .subscribe();

      const req = ambiente.controller.expectOne('/api/selecao/editais/edt-1');
      expect(req.request.headers.get('Accept')).toBe('application/vnd.uniplus.edital.v1+json');
      req.flush({ id: 'edt-1', numero: 1 });
    });

    it('sem withVendorMime, request não recebe Accept vendor (default Angular preserva)', () => {
      ambiente.http
        .get<ApiResult<Edital>>('/api/selecao/editais', { context: new HttpContext() })
        .subscribe();

      const req = ambiente.controller.expectOne('/api/selecao/editais');
      const accept = req.request.headers.get('Accept');
      expect(accept ?? '').not.toContain('vnd.uniplus');
      req.flush([]);
    });
  });

  describe('Idempotency-Key injection (ADR-0014)', () => {
    it('quando withIdempotencyKey é usado, request anexa header Idempotency-Key', () => {
      const explicitKey = idempotencyKey.create();

      ambiente.http
        .post<
          ApiResult<Edital>
        >('/api/selecao/editais', { titulo: 'X' }, { context: withIdempotencyKey(explicitKey) })
        .subscribe();

      const req = ambiente.controller.expectOne('/api/selecao/editais');
      expect(req.request.headers.get('Idempotency-Key')).toBe(explicitKey);
      req.flush({ id: 'edt-9', numero: 9 }, { status: 201, statusText: 'Created' });
    });

    it('compõe vendor MIME + Idempotency-Key num só HttpContext', () => {
      const composed = withVendorMime('edital', 1).set(
        IDEMPOTENCY_KEY_TOKEN,
        idempotencyKey.create(),
      );

      ambiente.http
        .post<ApiResult<Edital>>('/api/selecao/editais', { titulo: 'X' }, { context: composed })
        .subscribe();

      const req = ambiente.controller.expectOne('/api/selecao/editais');
      expect(req.request.headers.get('Accept')).toBe('application/vnd.uniplus.edital.v1+json');
      expect(req.request.headers.get('Idempotency-Key')).not.toBeNull();
      req.flush({ id: 'edt-1', numero: 1 }, { status: 201, statusText: 'Created' });
    });

    it('sem withIdempotencyKey, request não recebe header Idempotency-Key', () => {
      ambiente.http.get<ApiResult<Edital>>('/api/selecao/editais').subscribe();

      const req = ambiente.controller.expectOne('/api/selecao/editais');
      expect(req.request.headers.get('Idempotency-Key')).toBeNull();
      req.flush([]);
    });
  });
});
