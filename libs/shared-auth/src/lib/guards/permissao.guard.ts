import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import type { CodigoDePermissao, ModuloDePermissao } from '@uniplus/shared-auth/bootstrap';

/**
 * Guarda de rota pelas permissões efetivas. Sem sessão, dispara o login (401); com sessão e sem a
 * permissão, ou com a consulta indisponível, leva a `/acesso-negado` (403). A decisão real
 * continua sendo da API a cada requisição.
 *
 * @param codigos permissões aceitas (OR lógico).
 */
export function permissaoGuard(...codigos: readonly CodigoDePermissao[]): CanActivateFn {
  return decidir((permissoes) => permissoes.temAlguma(...codigos));
}

/** Como {@link permissaoGuard}, aceitando qualquer permissão dos módulos informados. */
export function permissaoNoModuloGuard(...modulos: readonly ModuloDePermissao[]): CanActivateFn {
  return decidir((permissoes) => permissoes.temNoModulo(...modulos));
}

function decidir(permitido: (permissoes: PermissoesService) => boolean): CanActivateFn {
  return async (_route, state) => {
    const auth = inject(AuthService);
    const permissoes = inject(PermissoesService);
    const router = inject(Router);

    if (!auth.authenticated()) {
      void auth.login(state.url);
      return false;
    }

    await permissoes.garantir();
    return permitido(permissoes) ? true : router.createUrlTree(['/acesso-negado']);
  };
}
