import { HttpContextToken } from '@angular/common/http';

/**
 * Token consumido pelo `apiResultInterceptor` (ADR-0011/0014). Quando
 * populado, o interceptor anexa `Idempotency-Key: <value>` ao request.
 *
 * Default `null` — endpoints sem idempotência não são tocados. Fica sem o
 * gerador de chave, que o interceptor do carregamento inicial não usa.
 */
export const IDEMPOTENCY_KEY_TOKEN = new HttpContextToken<string | null>(() => null);
