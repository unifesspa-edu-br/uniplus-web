import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Interceptor de erros de autenticação/autorização:
 *
 * - **401 Unauthorized** → dispara `authService.login()` (redireciona
 *   o usuário para o Keycloak). Usado quando o backend rejeita o token
 *   (ex.: sessão revogada, clock skew, refresh falhou).
 * - **403 Forbidden** → redireciona para `/acesso-negado`. O usuário
 *   está autenticado mas não tem permissão para o recurso solicitado.
 *
 * Outros status não são tratados aqui — ficam a cargo do
 * `errorInterceptor` de `@uniplus/shared-core` (0, 5xx) e de handlers
 * específicos por feature.
 *
 * Deve ser registrado depois do `tokenInterceptor` e preferencialmente
 * antes de interceptors que apresentam erros em UI (ex.: toasts),
 * para que um 401 não exiba um toast antes de redirecionar.
 */
export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 401) {
          void authService.login();
        } else if (error.status === 403) {
          void router.navigate(['/acesso-negado']);
        }
      }
      return throwError(() => error);
    }),
  );
};
