import { Routes } from '@angular/router';

export const LOCAIS_OFERTA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./locais-oferta.page').then((m) => m.LocaisOfertaPage),
  },
];
