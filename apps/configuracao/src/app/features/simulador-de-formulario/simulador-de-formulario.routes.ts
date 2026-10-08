import { Routes } from '@angular/router';

/** O simulador de formulário, a partir de um modelo gravado ou de um arquivo. */
export const SIMULADOR_DE_FORMULARIO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./simulador-de-formulario.page').then((m) => m.SimuladorDeFormularioPage),
  },
];
