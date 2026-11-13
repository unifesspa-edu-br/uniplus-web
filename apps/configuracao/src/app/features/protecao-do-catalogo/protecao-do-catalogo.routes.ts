import { Routes } from '@angular/router';
import { provideMensagensDaProtecaoDoCatalogo } from './protecao-do-catalogo.mensagens';

export const PROTECAO_DO_CATALOGO_ROUTES: Routes = [
  {
    path: '',
    providers: [provideMensagensDaProtecaoDoCatalogo()],
    loadComponent: () =>
      import('./protecao-do-catalogo.page').then((m) => m.ProtecaoDoCatalogoPage),
  },
];
