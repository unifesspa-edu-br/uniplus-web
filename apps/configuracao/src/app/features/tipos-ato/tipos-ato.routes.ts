import { Routes } from '@angular/router';

export const TIPOS_ATO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./tipos-ato.page').then((m) => m.TiposAtoPage),
  },
];
