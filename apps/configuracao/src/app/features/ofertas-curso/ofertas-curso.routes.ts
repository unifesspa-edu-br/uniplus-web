import { Routes } from '@angular/router';

export const OFERTAS_CURSO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./ofertas-curso.page').then((m) => m.OfertasCursoPage),
  },
];
