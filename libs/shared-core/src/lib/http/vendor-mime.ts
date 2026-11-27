import { HttpContext, HttpContextToken } from '@angular/common/http';

/**
 * Versionamento per-resource (ADR-0028 do `uniplus-api`). O service declara o
 * recurso e a versão; o `apiResultInterceptor` injeta o header
 * `Accept: application/vnd.uniplus.<resource>.v<N>+json` quando o token está
 * presente no `HttpContext` da requisição.
 */
export interface VendorMimeDeclaration {
  readonly resource: string;
  readonly version: number;
}

export const VENDOR_MIME_TOKEN = new HttpContextToken<VendorMimeDeclaration | null>(() => null);

/**
 * Retorna um `HttpContext` com a declaração de versão do recurso anexada ao
 * `VENDOR_MIME_TOKEN`. Quando o caller já mantém um `HttpContext` com outros
 * tokens (ex.: `IDEMPOTENCY_KEY_TOKEN`), pode encadear:
 *
 * ```ts
 * const ctx = withVendorMime('edital', 1).set(SOME_OTHER_TOKEN, value);
 * http.get(url, { context: ctx });
 * ```
 *
 * Com `base`, parte de uma cópia dos tokens dela; o contexto recebido não é alterado.
 */
export function withVendorMime(
  resource: string,
  version: number,
  base: HttpContext = new HttpContext(),
): HttpContext {
  if (!resource || !Number.isInteger(version) || version < 1) {
    throw new Error(
      `withVendorMime: resource não pode ser vazio e version deve ser inteiro >= 1 (recebido resource="${resource}", version=${version}).`,
    );
  }
  return copiar(base).set(VENDOR_MIME_TOKEN, { resource, version });
}

export function buildVendorMimeAccept(resource: string, version: number): string {
  return `application/vnd.uniplus.${resource}.v${version}+json`;
}

function copiar(base: HttpContext): HttpContext {
  const copia = new HttpContext();
  for (const token of base.keys()) copia.set(token, base.get(token));
  return copia;
}
