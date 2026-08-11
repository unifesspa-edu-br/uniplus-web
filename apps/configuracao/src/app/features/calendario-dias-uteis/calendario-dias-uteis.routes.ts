import { Routes } from '@angular/router';

export const CALENDARIO_DIAS_UTEIS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./calendario-dias-uteis-list.page').then((m) => m.CalendarioDiasUteisListPage),
  },
  {
    path: 'novo',
    loadComponent: () =>
      import('./calendario-dias-uteis-novo.page').then((m) => m.CalendarioDiasUteisNovoPage),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./calendario-dias-uteis-detalhe.page').then((m) => m.CalendarioDiasUteisDetalhePage),
  },
];
