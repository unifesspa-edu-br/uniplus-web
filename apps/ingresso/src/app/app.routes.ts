import { Routes } from '@angular/router';
import { AccessDeniedComponent } from '@uniplus/shared-auth/components';
import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import type { ModuloDePermissao } from '@uniplus/shared-auth/bootstrap';
import { authGuard, permissaoNoModuloGuard } from '@uniplus/shared-auth/guards';

/**
 * O catálogo ainda não tem o módulo Ingresso: o backoffice abre a quem tem permissão em algum
 * módulo e fecha a quem tem só a sessão (candidato, por exemplo).
 */
const MODULOS_DO_CATALOGO = Object.keys(PERMISSAO) as ModuloDePermissao[];

export const appRoutes: Routes = [
  {
    path: 'acesso-negado',
    component: AccessDeniedComponent,
  },
  {
    // Backoffice Ingresso: todas as rotas exigem autenticação e alguma permissão efetiva.
    path: '',
    loadComponent: () => import('./layout/layout').then((m) => m.LayoutComponent),
    canActivate: [authGuard, permissaoNoModuloGuard(...MODULOS_DO_CATALOGO)],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'chamadas',
        loadChildren: () =>
          import('./features/chamadas/chamadas.routes').then((m) => m.CHAMADAS_ROUTES),
      },
      {
        path: 'convocacoes',
        loadChildren: () =>
          import('./features/convocacoes/convocacoes.routes').then((m) => m.CONVOCACOES_ROUTES),
      },
      {
        path: 'matriculas',
        loadChildren: () =>
          import('./features/matriculas/matriculas.routes').then((m) => m.MATRICULAS_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
