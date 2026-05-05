import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Reage a respostas já envelopadas pelo `apiResultInterceptor` de
 * `@uniplus/shared-core` (ADR-0011 + ADR-0012):
 *
 * - **401 Unauthorized** → dispara `authService.login()` (redirect Keycloak).
 * - **403 Forbidden** → redireciona para `/acesso-negado`.
 *
 * Como o `apiResultInterceptor` converte 4xx/5xx em `HttpResponse` carregando
 * `ApiResult.fail` (preservando o `status` HTTP original), este interceptor
 * opera apenas sobre `HttpResponse` via `tap`, sem `catchError`. Os demais
 * status são ignorados — feedback de UI fica a cargo do componente
 * consumidor a partir do `ApiResult` recebido.
 *
 * Wiring: deve ficar mais externo que `apiResultInterceptor` no array de
 * `withInterceptors([...])`, ou seja, registrado **antes** dele.
 */
export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    tap((event) => {
      if (!(event instanceof HttpResponse)) {
        return;
      }
      if (event.status === 401) {
        void authService.login();
      } else if (event.status === 403) {
        void router.navigate(['/acesso-negado']);
      }
    }),
  );
};
