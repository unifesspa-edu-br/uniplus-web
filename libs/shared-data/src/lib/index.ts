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
// `TipoProcesso` do schema gerado (que é um inteiro do .NET enum) NÃO é
// re-exportado para evitar colisão com a string union já exposta por
// `models/edital.model.ts`. O campo `EditalDto.tipoProcesso` já é `string`
// no próprio DTO; quando precisarmos do enum gerado, importamos diretamente
// de `./api/selecao/schema`.
export { SELECAO_BASE_PATH } from './api/selecao/tokens';
export { INGRESSO_BASE_PATH } from './api/ingresso/tokens';
export { EditaisApi } from './api/selecao/editais.api';
export type { EditalDto, CriarEditalCommand } from './api/selecao/editais.api';

// Utils
export { isValidCpf, formatCpf, maskCpf } from './utils/cpf.util';
export { formatDateBr, formatDateTimeBr, parseDate } from './utils/date.util';

// Validators
export { cpfValidator } from './validators/cpf.validator';
