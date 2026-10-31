import { Routes } from '@angular/router';
import { AccessDeniedComponent } from '@uniplus/shared-auth/components';
import { acessoNegadoGuard, authGuard, permissaoGuard } from '@uniplus/shared-auth/guards';
import { PERMISSOES_DAS_TELAS } from './acesso/permissoes-das-telas';
import {
  acessoAoPainel,
  entradaDaSelecao,
  redirecionaEntradaAntigaParaPainel,
} from './acesso/acompanhamento.guard';

export const appRoutes: Routes = [
  {
    // Página de 403 — acessível sem permissão específica, só com sessão.
    path: 'acesso-negado',
    canActivate: [acessoNegadoGuard],
    component: AccessDeniedComponent,
  },
  {
    // Backoffice Seleção: todas as rotas exigem autenticação e, em cada entrada, a permissão
    // efetiva que a API declara para ela (`PERMISSOES_DAS_TELAS`).
    path: '',
    loadComponent: () => import('./layout/layout').then((m) => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', canActivate: [entradaDaSelecao], children: [] },
      {
        path: 'dashboard',
        canActivate: [acessoAoPainel],
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'processo-seletivo',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['processo-seletivo'])],
        loadChildren: () =>
          import('./features/processo-seletivo/processo-seletivo.routes').then(
            (m) => m.PROCESSO_SELETIVO_ROUTES,
          ),
      },
      {
        path: 'inscricoes',
        canActivate: [
          permissaoGuard(...PERMISSOES_DAS_TELAS.inscricoes),
          redirecionaEntradaAntigaParaPainel,
        ],
        loadChildren: () =>
          import('./features/inscricoes/inscricoes.routes').then((m) => m.INSCRICOES_ROUTES),
      },
      {
        path: 'homologacao',
        canActivate: [
          permissaoGuard(...PERMISSOES_DAS_TELAS.homologacao),
          redirecionaEntradaAntigaParaPainel,
        ],
        loadChildren: () =>
          import('./features/homologacao/homologacao.routes').then((m) => m.HOMOLOGACAO_ROUTES),
      },
      {
        path: 'notas',
        canActivate: [
          permissaoGuard(...PERMISSOES_DAS_TELAS.notas),
          redirecionaEntradaAntigaParaPainel,
        ],
        loadChildren: () => import('./features/notas/notas.routes').then((m) => m.NOTAS_ROUTES),
      },
      {
        path: 'classificacao',
        canActivate: [
          permissaoGuard(...PERMISSOES_DAS_TELAS.classificacao),
          redirecionaEntradaAntigaParaPainel,
        ],
        loadChildren: () =>
          import('./features/classificacao/classificacao.routes').then(
            (m) => m.CLASSIFICACAO_ROUTES,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
