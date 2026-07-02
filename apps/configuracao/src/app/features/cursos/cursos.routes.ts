import { Routes } from '@angular/router';

export const CURSOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./cursos.page').then((m) => m.CursosPage),
  },
];
