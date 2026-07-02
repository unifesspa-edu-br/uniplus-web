import { Routes } from '@angular/router';

export const PESOS_ENEM_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pesos-enem.page').then((m) => m.PesosEnemPage),
  },
];
