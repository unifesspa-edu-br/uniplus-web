import { Routes } from '@angular/router';

export const EDITAIS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./editais-list.page').then((m) => m.EditaisListPage),
  },
];
