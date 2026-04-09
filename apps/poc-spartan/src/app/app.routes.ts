import { Route } from '@angular/router';
import { LayoutComponent } from './layout/layout';

export const appRoutes: Route[] = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', redirectTo: 'inscricao', pathMatch: 'full' },
      {
        path: 'inscricao',
        loadComponent: () =>
          import('./features/inscricao/inscricao-page').then(
            (m) => m.InscricaoPageComponent
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
