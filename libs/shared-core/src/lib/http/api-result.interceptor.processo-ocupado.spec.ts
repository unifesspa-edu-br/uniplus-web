import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiResult, isApiFailure } from './api-result';
import {
  AmbienteHttp,
  prepararAmbienteHttp,
  problemJson,
  problemaDe,
} from './api-result.interceptor.testing';
import { CODIGO_ESPERA_ESGOTADA, withIdempotencyKey } from './idempotency';

const URL = '/api/selecao/processos-seletivos/p-1/publicar';

describe('apiResultInterceptor — processo ocupado (503 espera_esgotada)', () => {
  let ambiente: AmbienteHttp;

  beforeEach(() => {
    ambiente = prepararAmbienteHttp();
  });
  afterEach(() => ambiente.controller.verify());

  const enviar = (comChave: boolean, headers: Record<string, string>): ApiResult<unknown> => {
    let recebido: ApiResult<unknown> | undefined;
    const contexto = comChave ? withIdempotencyKey('chave-1') : undefined;
    ambiente.http.post<ApiResult<unknown>>(URL, {}, { context: contexto }).subscribe((r) => {
      recebido = r;
    });
    const req = ambiente.controller.expectOne(URL);
    const falha = problemJson(
      503,
      'Service Unavailable',
      problemaDe(503, CODIGO_ESPERA_ESGOTADA, 'Processo ocupado por outra operação'),
      headers,
    );
    req.flush(falha.corpo, falha.init);
    return recebido as ApiResult<unknown>;
  };

  it('com chave de idempotência, devolve a falha sem reenviar a requisição', () => {
    const resultado = enviar(true, {});
    expect(isApiFailure(resultado)).toBe(true);
    expect(isApiFailure(resultado) && resultado.problem.code).toBe(CODIGO_ESPERA_ESGOTADA);
  });

  it('com Retry-After, também não espera nem reenvia por conta própria', () => {
    const resultado = enviar(true, { 'Retry-After': '2' });
    expect(isApiFailure(resultado) && resultado.status).toBe(503);
  });

  it('sem chave de idempotência, devolve a falha sem reenviar', () => {
    const resultado = enviar(false, {});
    expect(isApiFailure(resultado) && resultado.problem.code).toBe(CODIGO_ESPERA_ESGOTADA);
  });
});
