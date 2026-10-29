import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import {
  AppConfigService,
  resolveAcompanhamentoValidacaoHabilitada,
} from '@uniplus/shared-data/config';
import { PERMISSOES_DAS_TELAS, type CaminhoDeTela } from './permissoes-das-telas';

/** Se a navegação de acompanhamento para validação está ligada neste ambiente. */
export function acompanhamentoValidacaoHabilitada(): boolean {
  return resolveAcompanhamentoValidacaoHabilitada(inject(AppConfigService).config());
}

/**
 * Se a pessoa abre a tela: pela permissão dela em `PERMISSOES_DAS_TELAS` ou, com a validação
 * ligada, no caso do painel, por estar autenticada (a opção não concede autorização na API: um
 * 403 continua levando a `/acesso-negado`).
 */
export function podeAbrirTela(
  permissoes: PermissoesService,
  tela: CaminhoDeTela,
  validacaoHabilitada: boolean,
): boolean {
  return (
    (validacaoHabilitada && tela === 'dashboard') ||
    permissoes.temAlguma(...PERMISSOES_DAS_TELAS[tela])
  );
}

/** Guarda do painel: a permissão do acompanhamento, ou só a sessão com a validação ligada. */
export const acessoAoPainel: CanActivateFn = async () => {
  const permissoes = inject(PermissoesService);
  const router = inject(Router);
  const validacaoHabilitada = acompanhamentoValidacaoHabilitada();
  await permissoes.garantir();
  return podeAbrirTela(permissoes, 'dashboard', validacaoHabilitada)
    ? true
    : router.createUrlTree(['/acesso-negado']);
};

/**
 * Raiz do app: leva à primeira tela, na ordem de `PERMISSOES_DAS_TELAS`, que a pessoa pode abrir.
 * Sem permissão para nenhuma, `/acesso-negado`.
 */
export const entradaDaSelecao: CanActivateFn = async () => {
  const permissoes = inject(PermissoesService);
  const router = inject(Router);
  const validacaoHabilitada = acompanhamentoValidacaoHabilitada();
  await permissoes.garantir();
  const caminhos = Object.keys(PERMISSOES_DAS_TELAS) as CaminhoDeTela[];
  const primeira = caminhos.find((caminho) =>
    podeAbrirTela(permissoes, caminho, validacaoHabilitada),
  );
  return router.createUrlTree([primeira === undefined ? '/acesso-negado' : `/${primeira}`]);
};

/**
 * Com a validação ligada, as entradas isoladas antigas (`/inscricoes`, `/homologacao`, `/notas`,
 * `/classificacao`) levam ao painel, a quem pode abri-lo. Vai depois do `permissaoGuard` da rota,
 * que continua valendo. Só o caminho exato da rota é redirecionado; qualquer subrota segue para o
 * destino existente.
 */
export const redirecionaEntradaAntigaParaPainel: CanActivateFn = async (route, state) => {
  const caminho = state.url.split(/[?#]/)[0].replace(/\/+$/, '');
  const entradaExata = caminho === `/${route.routeConfig?.path}`;
  if (!acompanhamentoValidacaoHabilitada() || !entradaExata) return true;

  const permissoes = inject(PermissoesService);
  const router = inject(Router);
  await permissoes.garantir();
  return podeAbrirTela(permissoes, 'dashboard', true) ? router.createUrlTree(['/dashboard']) : true;
};
