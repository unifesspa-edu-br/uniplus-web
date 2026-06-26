import { Routes } from '@angular/router';

export const PESO_ENEM_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./peso-enem.page').then((m) => m.PesoEnemPage),
  },
];
