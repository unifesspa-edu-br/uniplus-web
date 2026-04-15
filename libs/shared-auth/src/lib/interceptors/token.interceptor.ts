import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { AUTH_ALLOWED_URLS } from '../tokens/auth.tokens';

/**
 * Interceptor que anexa `Authorization: Bearer <token>` às requisições
 * destinadas a URLs da allowlist (`AUTH_ALLOWED_URLS`).
 *
 * Requisições para qualquer outro destino seguem sem o header, evitando
 * vazamento de credenciais para domínios externos.
 */
export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const allowedUrls = inject(AUTH_ALLOWED_URLS);

  if (!isUrlAllowed(req, allowedUrls)) {
    return next(req);
  }

  const authService = inject(AuthService);
  const token = authService.getToken();

  if (!token) {
    return next(req);
  }

  const cloned = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
  return next(cloned);
};

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
