import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '@uniplus/shared-auth/bootstrap';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);

  if (authService.authenticated()) {
    return true;
  }

  void authService.login();
  return false;
};
