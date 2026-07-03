import { Routes } from '@angular/router';

export const TIPOS_DOCUMENTO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./tipos-documento-list.page').then((m) => m.TiposDocumentoListPage),
  },
];
