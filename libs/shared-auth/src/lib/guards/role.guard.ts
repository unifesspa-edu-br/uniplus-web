import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard de autorização baseado em realm roles. Distingue três cenários:
 *
 * 1. **Não autenticado** → dispara `login()` (equivalente a HTTP 401).
 * 2. **Autenticado, sem a role esperada** → redireciona para
 *    `/acesso-negado` (equivalente a HTTP 403). Esse caso aparece
 *    naturalmente em SPAs que aplicam `fullScopeAllowed=false`
 *    + `scopeMappings` por client (Story `uniplus-api#67` / PR #87):
 *    o mesmo user pode ter conjuntos diferentes de roles em cada
 *    SPA, e um token válido sem a role requerida ainda é uma falha
 *    de autorização (403), não de autenticação (401).
 * 3. **Autenticado com role** → permite navegação.
 *
 * @param requiredRoles lista de realm roles aceitas (OR lógico).
 */
export function roleGuard(...requiredRoles: string[]): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // Cenário 1 — não autenticado: 401.
    if (!authService.authenticated()) {
      void authService.login();
      return false;
    }

    // Cenário 2 — autenticado sem role: 403.
    const hasRole = requiredRoles.some((role) => authService.hasRole(role));
    if (!hasRole) {
      return router.createUrlTree(['/acesso-negado']);
    }

    // Cenário 3 — autorizado.
    return true;
  };
}
