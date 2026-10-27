import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { authGuard, roleGuard } from '@uniplus/shared-auth/guards';
import {
  AppConfigService,
  resolveAcompanhamentoValidacaoHabilitada,
} from '@uniplus/shared-data/config';

/** Papéis elegíveis no backoffice da Seleção. */
export const PAPEIS_DO_BACKOFFICE = ['admin', 'gestor', 'avaliador', 'plataforma-admin'] as const;

/** Se a navegação de acompanhamento para validação está ligada neste ambiente. */
export function acompanhamentoValidacaoHabilitada(): boolean {
  return resolveAcompanhamentoValidacaoHabilitada(inject(AppConfigService).config());
}

/**
 * Entrada de acompanhamento (painel e, adiante, a página contextual do processo). Com a validação
 * ligada, basta estar autenticado; desligada, vale o controle por papel do backoffice. A flag não
 * autoriza nada na API: um 403 continua levando a `/acesso-negado`.
 */
export const acessoAcompanhamentoGuard: CanActivateFn = (route, state) =>
  acompanhamentoValidacaoHabilitada()
    ? authGuard(route, state)
    : roleGuard(...PAPEIS_DO_BACKOFFICE)(route, state);

/**
 * Com a validação ligada, as entradas isoladas antigas (`/inscricoes`, `/homologacao`, `/notas`,
 * `/classificacao`) levam ao painel. Vai depois do `roleGuard` da rota, que continua valendo.
 * Só o caminho exato da rota é redirecionado; qualquer subrota segue para o destino existente.
 */
export const redirecionaEntradaAntigaParaPainel: CanActivateFn = (route, state) => {
  const caminho = state.url.split(/[?#]/)[0].replace(/\/+$/, '');
  const entradaExata = caminho === `/${route.routeConfig?.path}`;
  return acompanhamentoValidacaoHabilitada() && entradaExata
    ? inject(Router).createUrlTree(['/dashboard'])
    : true;
};
