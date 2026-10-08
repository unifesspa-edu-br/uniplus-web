import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';

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
    // A simulação do modelo vive no simulador de formulário; o endereço antigo continua valendo.
    path: ':id/simulacao',
    redirectTo: ({ params }) =>
      inject(Router).createUrlTree(['/simulador-de-formulario'], {
        queryParams: { modelo: params['id'] },
      }),
  },
  {
    path: ':id',
    data: { breadcrumb: 'Editar modelo' },
    loadComponent: () =>
      import('./modelo-formulario-edicao.page').then((m) => m.ModeloFormularioEdicaoPage),
  },
];
