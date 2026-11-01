import { Routes } from '@angular/router';

export const PROTECAO_DO_CATALOGO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./protecao-do-catalogo.page').then((m) => m.ProtecaoDoCatalogoPage),
  },
];
