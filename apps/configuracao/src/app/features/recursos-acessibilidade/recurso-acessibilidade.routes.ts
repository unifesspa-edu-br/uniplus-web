import { Routes } from '@angular/router';

export const RECURSOS_ACESSIBILIDADE: Routes = [
  {
    path: '',
    loadComponent: () => import('./recursos-acessibilidade-list.page').then(m => m.RecursosAcessibilidadeListPage)
  },
];
