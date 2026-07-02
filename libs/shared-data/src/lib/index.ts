// Models
export * from './models/edital.model';
export * from './models/inscricao.model';
export * from './models/candidato.model';
export * from './models/cota.model';
export * from './models/resultado.model';

// HTTP — `ProblemDetails` (RFC 9457) e `ApiResult<T>` vivem em
// `@uniplus/shared-core/http` desde a ADR-0012. O antigo
// `ApiErrorHandlerService` (RFC 7807) foi removido.

// API clients gerados (ADR-0013) — types via openapi-typescript em schema.ts;
// services Angular standalone manuais consumindo `withVendorMime` + `ApiResult`.
//
// O enum `TipoProcesso` foi removido do contrato (Story #455 do `uniplus-api`
// — promovido a FK preparatória `tipoEditalId` para a futura entidade
// `TipoEdital`); `models/edital.model.ts` mantém a string union homônima como
// modelo local não vinculado ao DTO gerado.
export { SELECAO_BASE_PATH } from './api/selecao/tokens';
export { INGRESSO_BASE_PATH } from './api/ingresso/tokens';
export { CONFIGURACAO_BASE_PATH } from './api/configuracao/tokens';
export { ORGANIZACAO_BASE_PATH } from './api/organizacao/tokens';
export { GEO_BASE_PATH } from './api/geo/tokens';
export { EditaisApi } from './api/selecao/editais.api';
export type { EditalDto, CriarEditalCommand } from './api/selecao/editais.api';
export {
  ORIGENS_UNIDADE,
  OrigemUnidade,
  TIPOS_UNIDADE,
  TipoUnidade,
  UnidadesApi,
  type AtualizarUnidadeCommand,
  type CriarUnidadeCommand,
  type UnidadeDto,
  type UnidadeOrigemOption,
  type UnidadeTipoOption,
} from './api/organizacao/unidades.api';

// Utils
export { isValidCpf, formatCpf, maskCpf } from './utils/cpf.util';
export { formatDateBr, formatDateTimeBr, parseDate } from './utils/date.util';

// Validators
export { cpfValidator } from './validators/cpf.validator';

// Runtime config (ADR-0021)
export type { AppConfig } from './config';
export { AppConfigService, provideRuntimeConfig, RUNTIME_CONFIG_PATH } from './config';
