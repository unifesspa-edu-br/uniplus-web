import { inject } from '@angular/core';
import { CanActivateFn, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '@uniplus/shared-auth/bootstrap';

/** Sem sessão, leva ao login e volta à rota que `rotaDeVolta` escolhe. */
export function exigeSessao(rotaDeVolta: (state: RouterStateSnapshot) => string): CanActivateFn {
  return (_route, state) => {
    const authService = inject(AuthService);

    if (authService.authenticated()) {
      return true;
    }

    void authService.login(rotaDeVolta(state));
    return false;
  };
}

export const authGuard: CanActivateFn = exigeSessao((state) => state.url);
