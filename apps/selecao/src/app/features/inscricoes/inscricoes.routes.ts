import { Routes } from '@angular/router';

/**
 * As telas da inscrição de um processo, abaixo de `/processo-seletivo/:id/inscricoes`. A lista é a
 * raiz; o detalhe de uma inscrição entra em `:inscricaoId`.
 */
export const INSCRICOES_DO_PROCESSO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./inscricoes-do-processo.page').then((m) => m.InscricoesDoProcessoPage),
    data: { breadcrumb: 'Inscrições' },
  },
];
