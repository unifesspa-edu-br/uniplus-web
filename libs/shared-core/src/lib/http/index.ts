export {
  apiFailure,
  apiOk,
  isApiFailure,
  isApiOk,
} from './api-result';
export type { ApiFailure, ApiOk, ApiResult } from './api-result';

export { apiResultInterceptor } from './api-result.interceptor';

export {
  errorResult,
  mockProblemDetails,
  mockValidationError,
  okResult,
} from './api-result.testing';

export {
  IDEMPOTENCY_KEY_TOKEN,
  idempotencyKey,
  isValidIdempotencyKey,
  withIdempotencyKey,
} from './idempotency';

export { CLIENT_PROBLEM_CODES } from './problem-details';
export type {
  ClientProblemCode,
  LegalReference,
  ProblemDetails,
  ProblemValidationError,
} from './problem-details';

export { ProblemI18nService } from './problem-i18n.service';
export type {
  ProblemAction,
  ProblemMessage,
  ProblemOverride,
} from './problem-i18n.service';

export {
  buildVendorMimeAccept,
  VENDOR_MIME_TOKEN,
  withVendorMime,
} from './vendor-mime';
export type { VendorMimeDeclaration } from './vendor-mime';
