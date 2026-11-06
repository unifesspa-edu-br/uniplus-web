import { Routes } from '@angular/router';

export const CONDICOES_ATENDIMENTO: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./condicoes-atendimento.page').then((m) => m.CondicoesAtendimentoPage),
  },
];
