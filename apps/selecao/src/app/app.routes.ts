import { Routes } from '@angular/router';
import { authGuard, roleGuard } from '@uniplus/shared-auth';
import { LayoutComponent } from './layout/layout';

export const appRoutes: Routes = [
  {
    // Backoffice Seleção: todas as rotas exigem autenticação.
    // Roles elegíveis nesta SPA: admin, gestor, avaliador.
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard, roleGuard('admin', 'gestor', 'avaliador')],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadChildren: () => import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'editais',
        canActivate: [roleGuard('admin', 'gestor')],
        loadChildren: () => import('./features/editais/editais.routes').then((m) => m.EDITAIS_ROUTES),
      },
      {
        path: 'inscricoes',
        canActivate: [roleGuard('admin', 'gestor')],
        loadChildren: () => import('./features/inscricoes/inscricoes.routes').then((m) => m.INSCRICOES_ROUTES),
      },
      {
        path: 'homologacao',
        canActivate: [roleGuard('admin', 'gestor', 'avaliador')],
        loadChildren: () => import('./features/homologacao/homologacao.routes').then((m) => m.HOMOLOGACAO_ROUTES),
      },
      {
        path: 'notas',
        canActivate: [roleGuard('admin', 'gestor', 'avaliador')],
        loadChildren: () => import('./features/notas/notas.routes').then((m) => m.NOTAS_ROUTES),
      },
      {
        path: 'classificacao',
        canActivate: [roleGuard('admin', 'gestor')],
        loadChildren: () => import('./features/classificacao/classificacao.routes').then((m) => m.CLASSIFICACAO_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
