import { Routes } from '@angular/router';
import { AccessDeniedComponent } from '@uniplus/shared-auth/components';
import { authGuard, roleGuard } from '@uniplus/shared-auth/guards';
import {
  PAPEIS_DO_BACKOFFICE,
  acessoAcompanhamentoGuard,
  redirecionaEntradaAntigaParaPainel,
} from './acesso/acompanhamento.guard';

export const appRoutes: Routes = [
  {
    // Página de 403 — acessível mesmo sem role específica (apenas
    // exige autenticação prévia via OIDC).
    path: 'acesso-negado',
    component: AccessDeniedComponent,
  },
  {
    // Backoffice Seleção: todas as rotas exigem autenticação. O controle por papel fica em cada
    // entrada: o acompanhamento tem regra própria (`acessoAcompanhamentoGuard`) e as demais
    // rotas ficam sob o grupo de papéis do backoffice. Roles elegíveis: admin, gestor, avaliador
    // e plataforma-admin — este último para a administração do certame, restrita por rota.
    path: '',
    loadComponent: () => import('./layout/layout').then((m) => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        canActivate: [acessoAcompanhamentoGuard],
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: '',
        canActivate: [roleGuard(...PAPEIS_DO_BACKOFFICE)],
        children: [
          {
            // Cadastro e configuração do certame são administração de plataforma:
            // as rotas correspondentes da API exigem `plataforma-admin`, e sem o
            // mesmo papel aqui um gestor entraria na tela só para receber 403 na
            // primeira gravação.
            path: 'processo-seletivo',
            canActivate: [roleGuard('plataforma-admin')],
            loadChildren: () =>
              import('./features/processo-seletivo/processo-seletivo.routes').then(
                (m) => m.PROCESSO_SELETIVO_ROUTES,
              ),
          },
          {
            path: 'inscricoes',
            canActivate: [roleGuard('admin', 'gestor'), redirecionaEntradaAntigaParaPainel],
            loadChildren: () =>
              import('./features/inscricoes/inscricoes.routes').then((m) => m.INSCRICOES_ROUTES),
          },
          {
            path: 'homologacao',
            canActivate: [
              roleGuard('admin', 'gestor', 'avaliador'),
              redirecionaEntradaAntigaParaPainel,
            ],
            loadChildren: () =>
              import('./features/homologacao/homologacao.routes').then((m) => m.HOMOLOGACAO_ROUTES),
          },
          {
            path: 'notas',
            canActivate: [
              roleGuard('admin', 'gestor', 'avaliador'),
              redirecionaEntradaAntigaParaPainel,
            ],
            loadChildren: () => import('./features/notas/notas.routes').then((m) => m.NOTAS_ROUTES),
          },
          {
            path: 'classificacao',
            canActivate: [roleGuard('admin', 'gestor'), redirecionaEntradaAntigaParaPainel],
            loadChildren: () =>
              import('./features/classificacao/classificacao.routes').then(
                (m) => m.CLASSIFICACAO_ROUTES,
              ),
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
