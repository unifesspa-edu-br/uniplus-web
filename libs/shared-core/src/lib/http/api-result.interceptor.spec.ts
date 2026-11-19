import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiFailure, ApiOk, ApiResult, isApiFailure, isApiOk } from './api-result';
import {
  AmbienteHttp,
  baseProblem,
  chamadaGet,
  chamadaPost,
  Edital,
  falhaDe,
  prepararAmbienteHttp,
  problemaDe,
  problemJson,
  receber,
  resposta,
} from './api-result.interceptor.testing';
import { CLIENT_PROBLEM_CODES, ProblemDetails } from './problem-details';
import { withVendorMime } from './vendor-mime';

interface ProblemaComPendencias extends ProblemDetails {
  readonly pendencias?: readonly unknown[];
}

const problemaDeValidacao: ProblemDetails = {
  ...problemaDe(422, 'uniplus.validacao', 'Erro de validação'),
  errors: [
    { field: 'cpf', code: 'Cpf.Invalido', message: 'CPF inválido' },
    { field: 'email', code: 'Email.Vazio', message: 'E-mail obrigatório' },
  ],
};

describe('apiResultInterceptor', () => {
  let ambiente: AmbienteHttp;

  beforeEach(() => {
    ambiente = prepararAmbienteHttp();
  });

  afterEach(() => {
    ambiente.controller.verify();
  });

  describe('respostas 2xx', () => {
    it('200 envelopa o body em ApiResult.ok com headers preservados', () => {
      const body: Edital = { id: 'edt-1', numero: 42 };
      const simulada = resposta(200, 'OK', body, { 'X-Page-Size': '20' });

      const recebido = receber(ambiente, chamadaGet('/api/selecao/editais/edt-1'), simulada);

      expect(recebido).toBeDefined();
      expect(isApiOk(recebido as ApiResult<Edital>)).toBe(true);
      const ok = recebido as ApiOk<Edital>;
      expect(ok.data).toEqual(body);
      expect(ok.status).toBe(200);
      expect(ok.headers.get('X-Page-Size')).toBe('20');
    });

    it('201 (created) também é envelopado como ApiResult.ok', () => {
      const simulada = resposta(201, 'Created', { id: 'edt-9', numero: 9 });

      const recebido = receber(ambiente, chamadaPost('/api/selecao/editais'), simulada);

      expect(isApiOk(recebido as ApiResult<Edital>)).toBe(true);
      expect((recebido as ApiOk<Edital>).status).toBe(201);
    });

    it('204 (no content) preserva data null como ApiResult.ok', () => {
      const chamada = chamadaPost('/api/selecao/editais/edt-1/publicar');

      const recebido = receber(ambiente, chamada, resposta(204, 'No Content', null));

      expect(isApiOk(recebido as ApiResult<null>)).toBe(true);
      expect((recebido as ApiOk<null>).data).toBeNull();
    });
  });

  describe('respostas 4xx/5xx com application/problem+json', () => {
    it('404 emite ApiResult.fail com ProblemDetails parseado', () => {
      const chamada = chamadaGet('/api/selecao/editais/missing');

      const recebido = receber(ambiente, chamada, problemJson(404, 'Not Found', baseProblem));

      expect(isApiFailure(recebido as ApiResult<Edital>)).toBe(true);
      const fail = recebido as ApiFailure;
      expect(fail.problem.code).toBe('uniplus.selecao.edital.nao_encontrado');
      expect(fail.problem.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
      expect(fail.problem.status).toBe(404);
    });

    it('422 carrega errors[] de validação completos (FluentValidation)', () => {
      const simulada = problemJson(422, 'Unprocessable', problemaDeValidacao);

      const fail = falhaDe(ambiente, chamadaPost('/api/selecao/editais'), simulada);

      expect(fail.problem.errors).toHaveLength(2);
      expect(fail.problem.errors?.[0]).toEqual({
        field: 'cpf',
        code: 'Cpf.Invalido',
        message: 'CPF inválido',
      });
    });

    it('401 (ADR-0034) é envelopado igualmente como ApiResult.fail', () => {
      const problema = problemaDe(401, 'uniplus.auth.unauthorized', 'Não autenticado');
      const simulada = problemJson(401, 'Unauthorized', problema, { 'WWW-Authenticate': 'Bearer' });

      const fail = falhaDe(ambiente, chamadaGet('/api/selecao/editais'), simulada);

      expect(fail.problem.code).toBe('uniplus.auth.unauthorized');
      expect(fail.headers.get('WWW-Authenticate')).toBe('Bearer');
    });

    it('406 carrega available_versions em snake_case (ADR-0028)', () => {
      const problema = {
        ...problemaDe(406, 'uniplus.contract.versao_nao_suportada', 'Versão não suportada'),
        available_versions: [1, 2],
      };
      const chamada = chamadaGet('/api/selecao/editais', withVendorMime('edital', 99));

      const fail = falhaDe(ambiente, chamada, problemJson(406, 'Not Acceptable', problema));

      expect(fail.problem.available_versions).toEqual([1, 2]);
      expect(fail.problem.code).toBe('uniplus.contract.versao_nao_suportada');
    });

    it('422 preserva extension nomeada por endpoint específico (ex.: pendencias)', () => {
      const chamada = chamadaGet('/api/selecao/processos-seletivos/1/publicacao');
      const problema = {
        ...baseProblem,
        status: 422,
        code: 'ProcessoSeletivo.DocumentoNaoConfirmado',
        pendencias: [{ codigo: 'x', dimensao: 'y', mensagem: 'z' }],
      };

      const fail = falhaDe(ambiente, chamada, problemJson(422, 'Unprocessable Entity', problema));

      const problem = fail.problem as ProblemaComPendencias;
      expect(problem.pendencias).toEqual([{ codigo: 'x', dimensao: 'y', mensagem: 'z' }]);
    });

    it('500 emite ApiResult.fail preservando code do backend', () => {
      const titulo = 'Servidor temporariamente indisponível';
      const problema = problemaDe(500, 'uniplus.servidor.indisponivel', titulo);
      const simulada = problemJson(500, 'Internal Server Error', problema);

      const fail = falhaDe(ambiente, chamadaGet('/api/selecao/editais'), simulada);

      expect(fail.problem.code).toBe('uniplus.servidor.indisponivel');
      expect(fail.problem.status).toBe(500);
    });

    it('quando o body chega como string JSON, ainda parseia corretamente', () => {
      const simulada = problemJson(404, 'Not Found', JSON.stringify(baseProblem));

      const fail = falhaDe(ambiente, chamadaGet('/api/selecao/editais/x'), simulada);

      expect(fail.problem.code).toBe('uniplus.selecao.edital.nao_encontrado');
    });
  });

  describe('fallbacks sintetizados client-side', () => {
    it('status 0 sintetiza ProblemDetails com code uniplus.client.network_error', () => {
      let received: ApiResult<unknown> | undefined;

      ambiente.http
        .get<ApiResult<unknown>>('/api/selecao/editais')
        .subscribe((res) => (received = res));
      ambiente.controller
        .expectOne('/api/selecao/editais')
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown' });

      const fail = received as ApiFailure;
      expect(fail.problem.code).toBe(CLIENT_PROBLEM_CODES.NETWORK_ERROR);
      expect(fail.problem.status).toBe(0);
      expect(fail.problem.traceId).toBe('');
    });

    it('500 sem application/problem+json sintetiza unexpected_response', () => {
      const html = resposta(500, 'Internal Server Error', '<html>Erro</html>', {
        'Content-Type': 'text/html',
      });

      const fail = falhaDe(ambiente, chamadaGet('/api/selecao/editais'), html);

      expect(fail.problem.code).toBe(CLIENT_PROBLEM_CODES.UNEXPECTED_RESPONSE);
      expect(fail.problem.status).toBe(500);
    });

    it('422 com errors:[] (array vazio) é normalizado como ausência de errors', () => {
      const problema = { ...problemaDeValidacao, errors: [] };
      const simulada = problemJson(422, 'Unprocessable', problema);

      const fail = falhaDe(ambiente, chamadaPost('/api/selecao/editais'), simulada);

      expect(fail.problem.errors).toBeUndefined();
    });

    it('400 com body application/problem+json mas shape incompleto vira unexpected_response', () => {
      const simulada = problemJson(400, 'Bad Request', { message: 'apenas message' });

      const fail = falhaDe(ambiente, chamadaGet('/api/selecao/editais'), simulada);

      expect(fail.problem.code).toBe(CLIENT_PROBLEM_CODES.UNEXPECTED_RESPONSE);
    });
  });
});
