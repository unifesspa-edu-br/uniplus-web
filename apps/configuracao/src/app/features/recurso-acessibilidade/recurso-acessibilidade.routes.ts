import { Routes } from '@angular/router';

export const RECURSO_ACESSIBILIDADE: Routes = [
  {
    path: '',
    loadComponent: () => import('./recursos-acessibilidade-list.page.ts').then(m => m.RecursoAcessibilidadeListPage)
  },
];
