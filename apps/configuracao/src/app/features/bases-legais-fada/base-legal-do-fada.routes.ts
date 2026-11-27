import { Routes } from '@angular/router';

export const BASE_LEGAL_DO_FADA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./base-legal-do-fada.page').then((m) => m.BaseLegalDoFadaPage),
  },
];
