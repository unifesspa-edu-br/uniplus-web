import { Routes } from '@angular/router';

export const TIPOS_ETAPA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./tipos-etapa.page').then((m) => m.TiposEtapaPage),
  },
];
