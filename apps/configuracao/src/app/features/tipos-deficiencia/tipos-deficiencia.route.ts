import { Routes } from '@angular/router';

export const TIPOS_DEFICIENCIA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./tipos-deficiencia-list.page').then(m => m.TiposDeficienciaListPage)
  },
];
