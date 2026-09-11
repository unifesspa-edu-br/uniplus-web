import { Routes } from '@angular/router';

export const BASE_LEGAL_BONUS_REGIONAL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./base-legal-bonus-regional-list.page').then((m) => m.BaseLegalBonusRegionalListPage),
  },
];
