import { Routes } from '@angular/router';
import { ProcessoSeletivoPage } from './processo-seletivo.page';

export const PROCESSO_SELETIVO_ROUTES: Routes = [
  {
    path: '',
    component: ProcessoSeletivoPage,
    data: {
      breadcrumb: 'Processo Seletivo',
    },
  },
];
