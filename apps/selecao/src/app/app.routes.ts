import { Routes } from '@angular/router';
import { AccessDeniedComponent } from '@uniplus/shared-auth/components';
import { acessoNegadoGuard, authGuard, permissaoGuard } from '@uniplus/shared-auth/guards';
import {
  PERMISSOES_DAS_INSCRICOES_DO_PROCESSO,
  PERMISSOES_DAS_TELAS,
} from './acesso/permissoes-das-telas';
import { redirecionaEntradaAntigaParaPainel } from './acesso/acompanhamento.guard';

export const appRoutes: Routes = [
  {
    // Página de 403 — acessível sem permissão específica, só com sessão.
    path: 'acesso-negado',
    canActivate: [acessoNegadoGuard],
    component: AccessDeniedComponent,
  },
  {
    // Backoffice Seleção: todas as rotas exigem autenticação. O painel só pede a sessão; as demais
    // entradas pedem a permissão efetiva que a API declara para elas (`PERMISSOES_DAS_TELAS`).
    path: '',
    loadComponent: () => import('./layout/layout').then((m) => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        // Antes de `processo-seletivo`, que exige configurar o processo: ver as inscrições tem
        // permissão própria.
        path: 'processo-seletivo/:id/inscricoes',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_INSCRICOES_DO_PROCESSO)],
        loadChildren: () =>
          import('./features/inscricoes/inscricoes.routes').then(
            (m) => m.INSCRICOES_DO_PROCESSO_ROUTES,
          ),
      },
      {
        path: 'processo-seletivo',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['processo-seletivo'])],
        loadChildren: () =>
          import('./features/processo-seletivo/processo-seletivo.routes').then(
            (m) => m.PROCESSO_SELETIVO_ROUTES,
          ),
      },
      // As entradas isoladas antigas levam ao painel; subrotas seguem para o destino e a proteção
      // que já têm. `/inscricoes` não tem subrotas: o resto cai no coringa.
      {
        path: 'inscricoes',
        pathMatch: 'full',
        canActivate: [redirecionaEntradaAntigaParaPainel],
        children: [],
      },
      {
        path: 'homologacao',
        canActivate: [
          redirecionaEntradaAntigaParaPainel,
          permissaoGuard(...PERMISSOES_DAS_TELAS.homologacao),
        ],
        loadChildren: () =>
          import('./features/homologacao/homologacao.routes').then((m) => m.HOMOLOGACAO_ROUTES),
      },
      {
        path: 'notas',
        canActivate: [
          redirecionaEntradaAntigaParaPainel,
          permissaoGuard(...PERMISSOES_DAS_TELAS.notas),
        ],
        loadChildren: () => import('./features/notas/notas.routes').then((m) => m.NOTAS_ROUTES),
      },
      {
        path: 'classificacao',
        canActivate: [
          redirecionaEntradaAntigaParaPainel,
          permissaoGuard(...PERMISSOES_DAS_TELAS.classificacao),
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
