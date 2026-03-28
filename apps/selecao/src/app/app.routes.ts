import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout';

export const appRoutes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadChildren: () => import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'editais',
        loadChildren: () => import('./features/editais/editais.routes').then((m) => m.EDITAIS_ROUTES),
      },
      {
        path: 'inscricoes',
        loadChildren: () => import('./features/inscricoes/inscricoes.routes').then((m) => m.INSCRICOES_ROUTES),
      },
      {
        path: 'homologacao',
        loadChildren: () => import('./features/homologacao/homologacao.routes').then((m) => m.HOMOLOGACAO_ROUTES),
      },
      {
        path: 'notas',
        loadChildren: () => import('./features/notas/notas.routes').then((m) => m.NOTAS_ROUTES),
      },
      {
        path: 'classificacao',
        loadChildren: () => import('./features/classificacao/classificacao.routes').then((m) => m.CLASSIFICACAO_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
