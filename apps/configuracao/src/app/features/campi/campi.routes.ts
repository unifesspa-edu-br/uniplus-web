import { Routes } from '@angular/router';

export const CAMPI_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./campi.page').then((m) => m.CampiPage),
  },
];
