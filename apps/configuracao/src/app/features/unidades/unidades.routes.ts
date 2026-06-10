import { Routes } from '@angular/router';

export const UNIDADES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./unidades.page').then((m) => m.UnidadesPage),
  },
];
