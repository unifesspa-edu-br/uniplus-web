import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, defer, switchMap } from 'rxjs';
import { AUTH_ALLOWED_URLS, RenovacaoDoAcesso } from '@uniplus/shared-auth/bootstrap';

/**
 * Interceptor que anexa `Authorization: Bearer <token>` às requisições
 * destinadas a URLs da allowlist (`AUTH_ALLOWED_URLS`).
 *
 * Antes de anexar o token, pede à `RenovacaoDoAcesso` o acesso do pedido: ela o renova se está para
 * vencer e a pessoa agiu desde que foi emitido. Pedido automático não adia a sessão.
 *
 * Requisições para domínios fora da allowlist seguem sem o header,
 * evitando vazamento de credenciais.
 */
export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const allowedUrls = inject(AUTH_ALLOWED_URLS);

  if (!isUrlAllowed(req, allowedUrls)) {
    return next(req);
  }

  const renovacao = inject(RenovacaoDoAcesso);

  return defer(() => renovacao.acessoParaOPedido()).pipe(
    switchMap((token) => attach(req, next, token)),
  );
};

function attach(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  token: string | undefined,
): Observable<HttpEvent<unknown>> {
  if (!token) {
    return next(req);
  }
  const cloned = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });
  return next(cloned);
}

function isUrlAllowed(req: HttpRequest<unknown>, allowedUrls: readonly string[]): boolean {
  if (allowedUrls.length === 0) {
    return false;
  }
  const target = resolveUrl(req.url);
  return allowedUrls.some((allowed) => matchesAllowedUrl(target, allowed));
}

function resolveUrl(url: string): string {
  try {
    return new URL(url, globalThis.location?.origin ?? 'http://localhost').toString();
  } catch {
    return url;
  }
}

function matchesAllowedUrl(target: string, allowed: string): boolean {
  const normalizedAllowed = allowed.endsWith('/') ? allowed : `${allowed}/`;
  const normalizedTarget = target.endsWith('/') ? target : `${target}/`;
  return normalizedTarget.startsWith(normalizedAllowed);
}
