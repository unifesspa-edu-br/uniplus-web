import { Routes } from '@angular/router';

export const MOTIVOS_DE_DECISAO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./motivos-de-decisao.page').then((m) => m.MotivosDeDecisaoPage),
  },
];
