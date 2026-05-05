/**
 * Wire format do erro emitido pela `uniplus-api`.
 *
 * Casa byte-perfect com o JSON descrito na ADR-0023 (RFC 9457 + extensions Uni+)
 * e na ADR-0034 (ProblemDetails para falhas JWT). Campos seguem o case-sensitive
 * declarado pelo backend — `code`/`traceId`/`errors[]` em camelCase, mas
 * `available_versions` em snake_case (vem da ADR-0028 de versionamento).
 *
 * @see https://www.rfc-editor.org/rfc/rfc9457.html
 */
export interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly instance?: string;
  /** Taxonomia `uniplus.<modulo>.<razao>` — chave estável para i18n e lógica de UI. */
  readonly code: string;
  /** W3C trace context (32 hex). String vazia em fallback sintetizado client-side. */
  readonly traceId: string;
  readonly errors?: ReadonlyArray<ProblemValidationError>;
  readonly legalReference?: LegalReference;
  readonly available_versions?: ReadonlyArray<number>;
}

export interface ProblemValidationError {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

export interface LegalReference {
  readonly source: string;
  readonly article?: string;
  readonly url?: string;
}

/**
 * Códigos sintéticos gerados pelo cliente quando não há `ProblemDetails` real
 * (falha de rede, body fora do contrato). Mantidos no namespace `uniplus.client.*`
 * para não colidir com códigos emitidos pelo backend.
 */
export const CLIENT_PROBLEM_CODES = {
  NETWORK_ERROR: 'uniplus.client.network_error',
  UNEXPECTED_RESPONSE: 'uniplus.client.unexpected_response',
} as const;

export type ClientProblemCode = (typeof CLIENT_PROBLEM_CODES)[keyof typeof CLIENT_PROBLEM_CODES];
