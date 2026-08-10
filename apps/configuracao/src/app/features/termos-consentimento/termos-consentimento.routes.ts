import { Routes } from '@angular/router';

export const TERMOS_CONSENTIMENTO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./termos-consentimento-list.page').then((m) => m.TermosConsentimentoListPage),
  },
  {
    path: 'novo',
    data: {
      breadcrumb: 'Novo termo',
    },
    loadComponent: () =>
      import('./termos-consentimento-detail.page').then((m) => m.TermosConsentimentoDetailPage),
  },
  {
    path: ':id',
    data: {
      breadcrumb: 'Editar termo',
    },
    loadComponent: () =>
      import('./termos-consentimento-detail.page').then((m) => m.TermosConsentimentoDetailPage),
  },
];
