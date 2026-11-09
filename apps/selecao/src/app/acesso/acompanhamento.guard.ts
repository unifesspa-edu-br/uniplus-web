import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * Entradas isoladas antigas (`/inscricoes`, `/homologacao`, `/notas`, `/classificacao`) levam ao
 * painel. Roda depois do `authGuard` do shell, então exige sessão, e antes do `permissaoGuard` da
 * rota: o redirecionamento não abre os dados da funcionalidade antiga, por isso não pede a
 * permissão dela. Só o caminho exato da rota é redirecionado (com barra final, query string ou
 * fragmento); qualquer subrota segue para o destino existente, com a sua proteção.
 */
export const redirecionaEntradaAntigaParaPainel: CanActivateFn = (route, state) => {
  const caminho = state.url.split(/[?#]/)[0].replace(/\/+$/, '');
  const entradaExata = caminho === `/${route.routeConfig?.path}`;
  return entradaExata ? inject(Router).createUrlTree(['/dashboard']) : true;
};
