import { Routes } from '@angular/router';
import { DashboardPage } from '../dashboard/dashboard.page';
import { ProcessoSeletivoPage } from './processo-seletivo.page';

export const PROCESSO_SELETIVO_ROUTES: Routes = [
  {
    path: '',
    component: DashboardPage,
    data: {
      breadcrumb: 'Processo Seletivo',
    },
  },
  {
    path: 'novo',
    component: ProcessoSeletivoPage,
    data: {
      breadcrumb: 'Novo Processo Seletivo',
    },
  },
  {
    path: ':id',
    component: ProcessoSeletivoPage,
    data: {
      breadcrumb: 'Processo Seletivo',
    },
  },
];
