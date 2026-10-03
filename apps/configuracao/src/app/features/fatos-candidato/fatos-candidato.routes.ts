import { Routes } from '@angular/router';

export const FATOS_CANDIDATO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./fatos-candidato.page').then((m) => m.FatosCandidatoPage),
  },
];
