import { Routes } from '@angular/router';
import { AccessDeniedComponent, authGuard, roleGuard } from '@uniplus/shared-auth';
import { LayoutComponent } from './layout/layout';

export const appRoutes: Routes = [
  {
    path: 'acesso-negado',
    component: AccessDeniedComponent,
  },
  {
    // Backoffice Ingresso: todas as rotas exigem autenticação.
    // Roles elegíveis nesta SPA: admin, gestor.
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard, roleGuard('admin', 'gestor')],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadChildren: () => import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'chamadas',
        loadChildren: () => import('./features/chamadas/chamadas.routes').then((m) => m.CHAMADAS_ROUTES),
      },
      {
        path: 'convocacoes',
        loadChildren: () => import('./features/convocacoes/convocacoes.routes').then((m) => m.CONVOCACOES_ROUTES),
      },
      {
        path: 'matriculas',
        loadChildren: () => import('./features/matriculas/matriculas.routes').then((m) => m.MATRICULAS_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
