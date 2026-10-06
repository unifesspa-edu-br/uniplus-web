import { Routes } from '@angular/router';

/**
 * A lista de modelos, com a criação no drawer, e a edição em tela própria: o formulário inteiro
 * não cabe num drawer.
 */
export const MODELOS_FORMULARIO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./modelos-formulario.page').then((m) => m.ModelosFormularioPage),
  },
  {
    path: ':id/simulacao',
    data: { breadcrumb: 'Simular o modelo' },
    loadComponent: () => import('./simulacao-do-modelo.page').then((m) => m.SimulacaoDoModeloPage),
  },
  {
    path: ':id',
    data: { breadcrumb: 'Editar modelo' },
    loadComponent: () =>
      import('./modelo-formulario-edicao.page').then((m) => m.ModeloFormularioEdicaoPage),
  },
];
