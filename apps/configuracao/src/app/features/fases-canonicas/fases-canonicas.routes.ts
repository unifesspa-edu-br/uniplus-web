import { Routes } from '@angular/router';

export const FASES_CANONICAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./fases-canonicas.page').then((m) => m.FasesCanonicasPage),
  },
];
