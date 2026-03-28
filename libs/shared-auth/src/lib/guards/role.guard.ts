import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export function roleGuard(...requiredRoles: string[]): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.authenticated()) {
      void authService.login();
      return false;
    }

    const hasRole = requiredRoles.some((role) => authService.hasRole(role));
    if (!hasRole) {
      return router.createUrlTree(['/acesso-negado']);
    }

    return true;
  };
}
