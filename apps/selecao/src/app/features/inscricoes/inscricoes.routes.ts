import { Routes } from '@angular/router';
import { permissaoGuard } from '@uniplus/shared-auth/guards';

import { PERMISSOES_DO_COMPROVANTE_DA_INSCRICAO } from '../../acesso/permissoes-das-telas';

/**
 * As telas da inscrição de um processo, abaixo de `/processo-seletivo/:id/inscricoes`. A lista é a
 * raiz; o detalhe de uma inscrição entra em `:inscricaoId` e o comprovante de cada envio dela, em
 * `:inscricaoId/comprovantes/:numero`. Todas herdam a permissão de consultar as inscrições do processo;
 * o comprovante exige também a de emitir, e quem não a tem vai a "Acesso negado" como em qualquer
 * rota guardada do app.
 */
export const INSCRICOES_DO_PROCESSO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./inscricoes-do-processo.page').then((m) => m.InscricoesDoProcessoPage),
    data: { breadcrumb: 'Inscrições' },
  },
  {
    path: ':inscricaoId',
    loadComponent: () =>
      import('./detalhe-da-inscricao.page').then((m) => m.DetalheDaInscricaoPage),
    data: { breadcrumb: 'Inscrição' },
  },
  {
    path: ':inscricaoId/comprovantes/:numero',
    canActivate: [permissaoGuard(...PERMISSOES_DO_COMPROVANTE_DA_INSCRICAO)],
    loadComponent: () =>
      import('./comprovante/comprovante-da-inscricao.page').then(
        (m) => m.ComprovanteDaInscricaoPage,
      ),
    data: { breadcrumb: 'Comprovante' },
  },
];
