import { HttpHeaders } from '@angular/common/http';
import { ApiFailure, ApiOk, apiFailure, apiOk } from './api-result';
import { ProblemDetails, ProblemValidationError } from './problem-details';

export function okResult<T>(data: T, status = 200, headers = new HttpHeaders()): ApiOk<T> {
  return apiOk(data, status, headers);
}

export function errorResult(
  problem: ProblemDetails,
  status?: number,
  headers = new HttpHeaders(),
): ApiFailure {
  return apiFailure(problem, status ?? problem.status, headers);
}

export function mockProblemDetails(overrides: Partial<ProblemDetails> = {}): ProblemDetails {
  return {
    type: 'https://uniplus.unifesspa.edu.br/errors/uniplus.test.fake',
    title: 'Erro simulado para teste',
    status: 500,
    code: 'uniplus.test.fake',
    traceId: '00000000000000000000000000000000',
    ...overrides,
  };
}

export function mockValidationError(
  overrides: Partial<ProblemValidationError> = {},
): ProblemValidationError {
  return {
    field: 'campoExemplo',
    code: 'Campo.Invalido',
    message: 'Valor inválido',
    ...overrides,
  };
}
