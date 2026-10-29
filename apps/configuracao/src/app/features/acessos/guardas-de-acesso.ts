import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';

/** Só espera as permissões da sessão chegarem; a decisão de acesso é de quem a declara. */
export const aguardarPermissoes: CanActivateFn = async () => {
  await inject(PermissoesService).garantir();
  return true;
};
