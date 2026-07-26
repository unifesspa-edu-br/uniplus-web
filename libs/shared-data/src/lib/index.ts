// Models
export * from './models/candidato.model';
export * from './models/cota.model';

// HTTP — `ProblemDetails` (RFC 9457) e `ApiResult<T>` vivem em
// `@uniplus/shared-core/http` desde a ADR-0012. O antigo
// `ApiErrorHandlerService` (RFC 7807) foi removido.

// API clients gerados (ADR-0013) — types via openapi-typescript em schema.ts;
// services Angular standalone manuais consumindo `withVendorMime` + `ApiResult`.
export { SELECAO_BASE_PATH } from './api/selecao/tokens';
export { INGRESSO_BASE_PATH } from './api/ingresso/tokens';
export { CONFIGURACAO_BASE_PATH } from './api/configuracao/tokens';
export { ORGANIZACAO_BASE_PATH } from './api/organizacao/tokens';
export { GEO_BASE_PATH } from './api/geo/tokens';
export {
  TIPOS_UNIDADE,
  TipoUnidade,
  UnidadesApi,
  type AtualizarUnidadeCommand,
  type CriarUnidadeCommand,
  type UnidadeDto,
  type UnidadeTipoOption,
} from './api/organizacao/unidades.api';

// Utils
export { isValidCpf, formatCpf, maskCpf } from './utils/cpf.util';
export { formatDateBr, formatDateTimeBr, parseDate } from './utils/date.util';

// Validators
export { cpfValidator } from './validators/cpf.validator';

// Runtime config (ADR-0021)
export type { AppConfig } from './config';
export { AppConfigService, provideRuntimeConfig, resolveRuntimeConfigPath } from './config';
