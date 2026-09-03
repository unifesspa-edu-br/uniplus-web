import { Routes } from '@angular/router';

export const TIPOS_PROCESSO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./tipos-processo.page').then((m) => m.TiposProcessoPage),
  },
];
