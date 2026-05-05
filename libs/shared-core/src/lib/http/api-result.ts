import { HttpHeaders } from '@angular/common/http';
import { ProblemDetails } from './problem-details';

/**
 * Discriminated union (ADR-0011 + ADR-0012) que envelopa toda resposta HTTP
 * consumida pelo `uniplus-web`. Narrowing por `result.ok` é nativo do TypeScript.
 *
 * Produzido pelo `apiResultInterceptor`; consumido por services e componentes.
 */
export type ApiResult<T> = ApiOk<T> | ApiFailure;

export interface ApiOk<T> {
  readonly ok: true;
  readonly data: T;
  readonly status: number;
  readonly headers: HttpHeaders;
}

export interface ApiFailure {
  readonly ok: false;
  readonly problem: ProblemDetails;
  readonly status: number;
  readonly headers: HttpHeaders;
}

export function apiOk<T>(data: T, status: number, headers: HttpHeaders): ApiOk<T> {
  return { ok: true, data, status, headers };
}

export function apiFailure(
  problem: ProblemDetails,
  status: number,
  headers: HttpHeaders,
): ApiFailure {
  return { ok: false, problem, status, headers };
}

/** Type guard para o lado feliz. */
export function isApiOk<T>(result: ApiResult<T>): result is ApiOk<T> {
  return result.ok;
}

/** Type guard para o lado de falha. */
export function isApiFailure<T>(result: ApiResult<T>): result is ApiFailure {
  return !result.ok;
}
