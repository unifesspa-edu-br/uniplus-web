import { Routes } from '@angular/router';

export const PRECEDENCIAS_FASE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./precedencias-fase.page').then((m) => m.PrecedenciasFasePage),
  },
];
