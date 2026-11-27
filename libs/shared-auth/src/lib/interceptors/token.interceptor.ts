import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, defer, switchMap } from 'rxjs';
import {
  AUTH_ALLOWED_URLS,
  AUTH_CONFIG,
  AuthService,
  antecedenciaEfetivaEmSegundos,
} from '@uniplus/shared-auth/bootstrap';

/**
 * Interceptor que anexa `Authorization: Bearer <token>` às requisições
 * destinadas a URLs da allowlist (`AUTH_ALLOWED_URLS`).
 *
 * Antes de anexar o token, verifica expiração (`isTokenExpired` com a antecedência da configuração) e,
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
  const { antecedenciaDaRenovacaoEmSegundos } = inject(AUTH_CONFIG);

  return defer(() => ensureFreshToken(authService, antecedenciaDaRenovacaoEmSegundos)).pipe(
    switchMap((token) => attach(req, next, token)),
  );
};

async function ensureFreshToken(
  authService: AuthService,
  antecedenciaConfigurada: number,
): Promise<string | undefined> {
  if (!authService.getToken()) return undefined;
  const antecedencia = antecedenciaDoAcesso(authService, antecedenciaConfigurada);
  if (authService.isTokenExpired(antecedencia)) {
    await authService.refreshToken(antecedencia);
  }
  return authService.getToken();
}

function antecedenciaDoAcesso(authService: AuthService, configurada: number): number {
  return antecedenciaEfetivaEmSegundos(configurada, authService.prazoDoAcesso());
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
