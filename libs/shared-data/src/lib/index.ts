// Models
export * from './models/edital.model';
export * from './models/inscricao.model';
export * from './models/candidato.model';
export * from './models/cota.model';
export * from './models/resultado.model';

// HTTP — `ProblemDetails` (RFC 9457) e `ApiResult<T>` vivem em
// `@uniplus/shared-core/http` desde a ADR-0012. O antigo
// `ApiErrorHandlerService` (RFC 7807) foi removido.

// Utils
export { isValidCpf, formatCpf, maskCpf } from './utils/cpf.util';
export { formatDateBr, formatDateTimeBr, parseDate } from './utils/date.util';

// Validators
export { cpfValidator } from './validators/cpf.validator';
