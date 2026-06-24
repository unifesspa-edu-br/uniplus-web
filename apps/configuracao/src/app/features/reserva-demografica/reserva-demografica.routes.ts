import { Routes } from '@angular/router';

export const RESERVA_DEMOGRAFICA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./reserva-demografica-list.page').then((m) => m.ReservaDemograficaListPage),
  },
];
