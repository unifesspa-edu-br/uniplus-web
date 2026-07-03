import { Routes } from '@angular/router';

export const TIPOS_BANCA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./tipos-banca.page').then((m) => m.TiposBancaPage),
  },
];
