import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, defer, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { AUTH_ALLOWED_URLS } from '../tokens/auth.tokens';

/**
 * Interceptor que anexa `Authorization: Bearer <token>` às requisições
 * destinadas a URLs da allowlist (`AUTH_ALLOWED_URLS`).
 *
 * Antes de anexar o token, verifica expiração (`isTokenExpired(30)`) e,
 * se necessário, dispara `refreshToken()` — garantindo que nenhuma
 * requisição viaje com um Bearer prestes a expirar.
 *
 * Requisições para domínios fora da allowlist seguem sem o header,
 * evitando vazamento de credenciais.
 */
export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const allowedUrls = inject(AUTH_ALLOWED_URLS);

  if (!isUrlAllowed(req, allowedUrls)) {
    return next(req);
  }

  const authService = inject(AuthService);

  return defer(() => ensureFreshToken(authService)).pipe(
    switchMap((token) => attach(req, next, token)),
  );
};

async function ensureFreshToken(authService: AuthService): Promise<string | undefined> {
  const current = authService.getToken();
  if (!current) {
    return undefined;
  }

  if (authService.isTokenExpired(30)) {
    await authService.refreshToken(30);
  }

  return authService.getToken();
}

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
