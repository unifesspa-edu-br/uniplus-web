import { Routes } from '@angular/router';

export const CONDICOES_ATENDIMENTO: Routes = [
  {
    path: '',
    loadComponent: () => import('./condicoes-atendimento-list').then((m) => m.CondicoesAtendimentoListPage),
  },
];
