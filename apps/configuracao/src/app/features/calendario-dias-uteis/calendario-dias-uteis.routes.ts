import { Routes } from '@angular/router';

export const CALENDARIO_DIAS_UTEIS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./calendario-dias-uteis-list.page').then((m) => m.CalendarioDiasUteisListPage),
  },
];
