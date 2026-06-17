import { Routes } from '@angular/router';

export const INSTITUICAO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./instituicao.page').then((m) => m.InstituicaoPage),
  },
];
