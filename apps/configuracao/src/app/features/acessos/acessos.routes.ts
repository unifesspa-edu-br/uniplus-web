import { Routes } from '@angular/router';
import { permissaoGuard } from '@uniplus/shared-auth/guards';
import { PERMISSOES_DA_JANELA_DE_MIGRACAO, PERMISSOES_DAS_TELAS } from '../../acesso/permissoes-das-telas';
import { aguardarPermissoes } from './guardas-de-acesso';
import { provideMensagensDeAcesso } from './mensagens-de-acesso';

export const ACESSOS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [aguardarPermissoes],
    providers: [provideMensagensDeAcesso()],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'pedidos' },
      {
        path: 'pedidos',
        data: { breadcrumb: 'Meus pedidos', fila: 'meus' },
        loadComponent: () => import('./pedidos.page').then((m) => m.PedidosPage),
      },
      {
        path: 'pedidos/novo',
        data: { breadcrumb: 'Pedir acesso' },
        loadComponent: () => import('./pedir-acesso.page').then((m) => m.PedirAcessoPage),
      },
      {
        path: 'pedidos/:id',
        data: { breadcrumb: 'Pedido de acesso' },
        loadComponent: () => import('./pedido-detalhe.page').then((m) => m.PedidoDetalhePage),
      },
      {
        path: 'fila-do-gestor',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['acessos/fila-do-gestor'])],
        data: { breadcrumb: 'Fila da gestão de acessos', fila: 'gestor' },
        loadComponent: () => import('./pedidos.page').then((m) => m.PedidosPage),
      },
      {
        path: 'fila-da-protecao-de-dados',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['acessos/fila-da-protecao-de-dados'])],
        data: { breadcrumb: 'Fila da proteção de dados', fila: 'protecao_de_dados' },
        loadComponent: () => import('./pedidos.page').then((m) => m.PedidosPage),
      },
      {
        path: 'historico',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['acessos/historico'])],
        data: { breadcrumb: 'Histórico de pedidos', fila: 'todos' },
        loadComponent: () => import('./pedidos.page').then((m) => m.PedidosPage),
      },
      {
        path: 'concessoes',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['acessos/concessoes'])],
        data: { breadcrumb: 'Concessões' },
        loadComponent: () => import('./concessoes.page').then((m) => m.ConcessoesPage),
      },
      {
        path: 'perfis',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['acessos/perfis'])],
        data: { breadcrumb: 'Perfis de acesso' },
        loadComponent: () => import('./perfis.page').then((m) => m.PerfisPage),
      },
      {
        path: 'versoes-de-perfil/gestao-de-acessos',
        canActivate: [
          permissaoGuard(...PERMISSOES_DAS_TELAS['acessos/versoes-de-perfil/gestao-de-acessos']),
        ],
        data: { breadcrumb: 'Versões de perfil na gestão de acessos', etapa: 'gestao_de_acessos' },
        loadComponent: () =>
          import('./versoes/fila-de-versoes.page').then((m) => m.FilaDeVersoesPage),
      },
      {
        path: 'versoes-de-perfil/protecao-de-dados',
        canActivate: [
          permissaoGuard(...PERMISSOES_DAS_TELAS['acessos/versoes-de-perfil/protecao-de-dados']),
        ],
        data: { breadcrumb: 'Versões de perfil na proteção de dados', etapa: 'protecao_de_dados' },
        loadComponent: () =>
          import('./versoes/fila-de-versoes.page').then((m) => m.FilaDeVersoesPage),
      },
      {
        path: 'janelas-de-migracao/gestao-de-acessos',
        canActivate: [
          permissaoGuard(...PERMISSOES_DAS_TELAS['acessos/janelas-de-migracao/gestao-de-acessos']),
        ],
        data: { breadcrumb: 'Janelas de migração na gestão de acessos', etapa: 'gestao_de_acessos' },
        loadComponent: () =>
          import('./janela/fila-de-janelas.page').then((m) => m.FilaDeJanelasPage),
      },
      {
        path: 'janelas-de-migracao/protecao-de-dados',
        canActivate: [
          permissaoGuard(...PERMISSOES_DAS_TELAS['acessos/janelas-de-migracao/protecao-de-dados']),
        ],
        data: { breadcrumb: 'Janelas de migração na proteção de dados', etapa: 'protecao_de_dados' },
        loadComponent: () =>
          import('./janela/fila-de-janelas.page').then((m) => m.FilaDeJanelasPage),
      },
      {
        path: 'perfis/:id/janela',
        canActivate: [permissaoGuard(...PERMISSOES_DA_JANELA_DE_MIGRACAO)],
        data: { breadcrumb: 'Janela de migração' },
        loadComponent: () =>
          import('./janela/janela-da-migracao.page').then((m) => m.JanelaDaMigracaoPage),
      },
      {
        path: 'perfis/:id',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['acessos/perfis'])],
        data: { breadcrumb: 'Perfil de acesso' },
        loadComponent: () =>
          import('./versoes/perfil-detalhe.page').then((m) => m.PerfilDetalhePage),
      },
    ],
  },
];
