import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ApiFailure,
  ApiOk,
  ApiResult,
  isApiFailure,
  isApiOk,
} from './api-result';
import { apiResultInterceptor } from './api-result.interceptor';
import {
  IDEMPOTENCY_KEY_TOKEN,
  idempotencyKey,
  withIdempotencyKey,
} from './idempotency';
import { CLIENT_PROBLEM_CODES, ProblemDetails } from './problem-details';
import { withVendorMime } from './vendor-mime';

interface Edital {
  readonly id: string;
  readonly numero: number;
}

const PROBLEM_HEADERS = { 'Content-Type': 'application/problem+json' };

const baseProblem: ProblemDetails = {
  type: 'https://uniplus.unifesspa.edu.br/errors/uniplus.selecao.edital.nao_encontrado',
  title: 'Edital não encontrado',
  status: 404,
  code: 'uniplus.selecao.edital.nao_encontrado',
  traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
};

describe('apiResultInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    controller.verify();
  });

  describe('respostas 2xx', () => {
    it('200 envelopa o body em ApiResult.ok com headers preservados', () => {
      const body: Edital = { id: 'edt-1', numero: 42 };
      let received: ApiResult<Edital> | undefined;

      http.get<ApiResult<Edital>>('/api/editais/edt-1').subscribe((res) => (received = res));

      controller
        .expectOne('/api/editais/edt-1')
        .flush(body, { status: 200, statusText: 'OK', headers: { 'X-Page-Size': '20' } });

      expect(received).toBeDefined();
      expect(isApiOk(received as ApiResult<Edital>)).toBe(true);
      const ok = received as ApiOk<Edital>;
      expect(ok.data).toEqual(body);
      expect(ok.status).toBe(200);
      expect(ok.headers.get('X-Page-Size')).toBe('20');
    });

    it('201 (created) também é envelopado como ApiResult.ok', () => {
      let received: ApiResult<Edital> | undefined;

      http.post<ApiResult<Edital>>('/api/editais', {}).subscribe((res) => (received = res));

      controller
        .expectOne('/api/editais')
        .flush({ id: 'edt-9', numero: 9 }, { status: 201, statusText: 'Created' });

      expect(isApiOk(received as ApiResult<Edital>)).toBe(true);
      expect((received as ApiOk<Edital>).status).toBe(201);
    });

    it('204 (no content) preserva data null como ApiResult.ok', () => {
      let received: ApiResult<null> | undefined;

      http
        .post<ApiResult<null>>('/api/editais/edt-1/publicar', {})
        .subscribe((res) => (received = res));

      controller
        .expectOne('/api/editais/edt-1/publicar')
        .flush(null, { status: 204, statusText: 'No Content' });

      expect(isApiOk(received as ApiResult<null>)).toBe(true);
      expect((received as ApiOk<null>).data).toBeNull();
    });
  });

  describe('respostas 4xx/5xx com application/problem+json', () => {
    it('404 emite ApiResult.fail com ProblemDetails parseado', () => {
      let received: ApiResult<Edital> | undefined;

      http.get<ApiResult<Edital>>('/api/editais/missing').subscribe((res) => (received = res));

      controller
        .expectOne('/api/editais/missing')
        .flush(baseProblem, { status: 404, statusText: 'Not Found', headers: PROBLEM_HEADERS });

      expect(isApiFailure(received as ApiResult<Edital>)).toBe(true);
      const fail = received as ApiFailure;
      expect(fail.problem.code).toBe('uniplus.selecao.edital.nao_encontrado');
      expect(fail.problem.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
      expect(fail.problem.status).toBe(404);
    });

    it('422 carrega errors[] de validação completos (FluentValidation)', () => {
      const problem: ProblemDetails = {
        ...baseProblem,
        type: 'https://uniplus.unifesspa.edu.br/errors/uniplus.validacao',
        title: 'Erro de validação',
        status: 422,
        code: 'uniplus.validacao',
        errors: [
          { field: 'cpf', code: 'Cpf.Invalido', message: 'CPF inválido' },
          { field: 'email', code: 'Email.Vazio', message: 'E-mail obrigatório' },
        ],
      };
      let received: ApiResult<unknown> | undefined;

      http.post<ApiResult<unknown>>('/api/editais', {}).subscribe((res) => (received = res));

      controller
        .expectOne('/api/editais')
        .flush(problem, { status: 422, statusText: 'Unprocessable', headers: PROBLEM_HEADERS });

      const fail = received as ApiFailure;
      expect(fail.problem.errors).toHaveLength(2);
      expect(fail.problem.errors?.[0]).toEqual({
        field: 'cpf',
        code: 'Cpf.Invalido',
        message: 'CPF inválido',
      });
    });

    it('401 (ADR-0034) é envelopado igualmente como ApiResult.fail', () => {
      let received: ApiResult<unknown> | undefined;

      http.get<ApiResult<unknown>>('/api/editais').subscribe((res) => (received = res));

      controller.expectOne('/api/editais').flush(
        {
          ...baseProblem,
          type: 'https://uniplus.unifesspa.edu.br/errors/uniplus.auth.unauthorized',
          title: 'Não autenticado',
          status: 401,
          code: 'uniplus.auth.unauthorized',
        },
        {
          status: 401,
          statusText: 'Unauthorized',
          headers: { ...PROBLEM_HEADERS, 'WWW-Authenticate': 'Bearer' },
        },
      );

      const fail = received as ApiFailure;
      expect(fail.problem.code).toBe('uniplus.auth.unauthorized');
      expect(fail.headers.get('WWW-Authenticate')).toBe('Bearer');
    });

    it('406 carrega available_versions em snake_case (ADR-0028)', () => {
      let received: ApiResult<unknown> | undefined;

      http
        .get<ApiResult<unknown>>('/api/editais', { context: withVendorMime('edital', 99) })
        .subscribe((res) => (received = res));

      controller.expectOne('/api/editais').flush(
        {
          ...baseProblem,
          type: 'https://uniplus.unifesspa.edu.br/errors/uniplus.contract.versao_nao_suportada',
          title: 'Versão não suportada',
          status: 406,
          code: 'uniplus.contract.versao_nao_suportada',
          available_versions: [1, 2],
        },
        { status: 406, statusText: 'Not Acceptable', headers: PROBLEM_HEADERS },
      );

      const fail = received as ApiFailure;
      expect(fail.problem.available_versions).toEqual([1, 2]);
      expect(fail.problem.code).toBe('uniplus.contract.versao_nao_suportada');
    });

    it('500 emite ApiResult.fail preservando code do backend', () => {
      let received: ApiResult<unknown> | undefined;

      http.get<ApiResult<unknown>>('/api/editais').subscribe((res) => (received = res));

      controller.expectOne('/api/editais').flush(
        {
          ...baseProblem,
          type: 'https://uniplus.unifesspa.edu.br/errors/uniplus.servidor.indisponivel',
          title: 'Servidor temporariamente indisponível',
          status: 500,
          code: 'uniplus.servidor.indisponivel',
        },
        { status: 500, statusText: 'Internal Server Error', headers: PROBLEM_HEADERS },
      );

      const fail = received as ApiFailure;
      expect(fail.problem.code).toBe('uniplus.servidor.indisponivel');
      expect(fail.problem.status).toBe(500);
    });

    it('quando o body chega como string JSON, ainda parseia corretamente', () => {
      let received: ApiResult<unknown> | undefined;

      http.get<ApiResult<unknown>>('/api/editais/x').subscribe((res) => (received = res));

      controller
        .expectOne('/api/editais/x')
        .flush(JSON.stringify(baseProblem), {
          status: 404,
          statusText: 'Not Found',
          headers: PROBLEM_HEADERS,
        });

      const fail = received as ApiFailure;
      expect(fail.problem.code).toBe('uniplus.selecao.edital.nao_encontrado');
    });
  });

  describe('fallbacks sintetizados client-side', () => {
    it('status 0 sintetiza ProblemDetails com code uniplus.client.network_error', () => {
      let received: ApiResult<unknown> | undefined;

      http.get<ApiResult<unknown>>('/api/editais').subscribe((res) => (received = res));

      controller.expectOne('/api/editais').error(new ProgressEvent('error'), {
        status: 0,
        statusText: 'Unknown',
      });

      const fail = received as ApiFailure;
      expect(fail.problem.code).toBe(CLIENT_PROBLEM_CODES.NETWORK_ERROR);
      expect(fail.problem.status).toBe(0);
      expect(fail.problem.traceId).toBe('');
    });

    it('500 sem application/problem+json sintetiza unexpected_response', () => {
      let received: ApiResult<unknown> | undefined;

      http.get<ApiResult<unknown>>('/api/editais').subscribe((res) => (received = res));

      controller.expectOne('/api/editais').flush('<html>Erro</html>', {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'text/html' },
      });

      const fail = received as ApiFailure;
      expect(fail.problem.code).toBe(CLIENT_PROBLEM_CODES.UNEXPECTED_RESPONSE);
      expect(fail.problem.status).toBe(500);
    });

    it('422 com errors:[] (array vazio) é normalizado como ausência de errors', () => {
      let received: ApiResult<unknown> | undefined;

      http.post<ApiResult<unknown>>('/api/editais', {}).subscribe((res) => (received = res));

      controller.expectOne('/api/editais').flush(
        {
          ...baseProblem,
          status: 422,
          code: 'uniplus.validacao',
          title: 'Erro de validação',
          errors: [],
        },
        { status: 422, statusText: 'Unprocessable', headers: PROBLEM_HEADERS },
      );

      const fail = received as ApiFailure;
      expect(fail.problem.errors).toBeUndefined();
    });

    it('400 com body application/problem+json mas shape incompleto vira unexpected_response', () => {
      let received: ApiResult<unknown> | undefined;

      http.get<ApiResult<unknown>>('/api/editais').subscribe((res) => (received = res));

      controller
        .expectOne('/api/editais')
        .flush({ message: 'apenas message' }, {
          status: 400,
          statusText: 'Bad Request',
          headers: PROBLEM_HEADERS,
        });

      const fail = received as ApiFailure;
      expect(fail.problem.code).toBe(CLIENT_PROBLEM_CODES.UNEXPECTED_RESPONSE);
    });
  });

  describe('vendor MIME injection (ADR-0028)', () => {
    it('quando withVendorMime é usado, request anexa Accept correto', () => {
      http
        .get<ApiResult<Edital>>('/api/editais/edt-1', {
          context: withVendorMime('edital', 1),
        })
        .subscribe();

      const req = controller.expectOne('/api/editais/edt-1');
      expect(req.request.headers.get('Accept')).toBe('application/vnd.uniplus.edital.v1+json');
      req.flush({ id: 'edt-1', numero: 1 });
    });

    it('sem withVendorMime, request não recebe Accept vendor (default Angular preserva)', () => {
      http.get<ApiResult<Edital>>('/api/editais', { context: new HttpContext() }).subscribe();

      const req = controller.expectOne('/api/editais');
      const accept = req.request.headers.get('Accept');
      expect(accept ?? '').not.toContain('vnd.uniplus');
      req.flush([]);
    });
  });

  describe('Idempotency-Key injection (ADR-0014)', () => {
    it('quando withIdempotencyKey é usado, request anexa header Idempotency-Key', () => {
      const explicitKey = idempotencyKey.create();

      http
        .post<ApiResult<Edital>>('/api/editais', { titulo: 'X' }, {
          context: withIdempotencyKey(explicitKey),
        })
        .subscribe();

      const req = controller.expectOne('/api/editais');
      expect(req.request.headers.get('Idempotency-Key')).toBe(explicitKey);
      req.flush({ id: 'edt-9', numero: 9 }, { status: 201, statusText: 'Created' });
    });

    it('compõe vendor MIME + Idempotency-Key num só HttpContext', () => {
      const composed = withVendorMime('edital', 1).set(
        IDEMPOTENCY_KEY_TOKEN,
        idempotencyKey.create(),
      );

      http
        .post<ApiResult<Edital>>('/api/editais', { titulo: 'X' }, { context: composed })
        .subscribe();

      const req = controller.expectOne('/api/editais');
      expect(req.request.headers.get('Accept')).toBe('application/vnd.uniplus.edital.v1+json');
      expect(req.request.headers.get('Idempotency-Key')).not.toBeNull();
      req.flush({ id: 'edt-1', numero: 1 }, { status: 201, statusText: 'Created' });
    });

    it('sem withIdempotencyKey, request não recebe header Idempotency-Key', () => {
      http.get<ApiResult<Edital>>('/api/editais').subscribe();

      const req = controller.expectOne('/api/editais');
      expect(req.request.headers.get('Idempotency-Key')).toBeNull();
      req.flush([]);
    });
  });
});
