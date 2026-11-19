import { Routes } from '@angular/router';
import { permissaoGuard } from '@uniplus/shared-auth/guards';
import {
  PERMISSOES_DA_CONCESSAO,
  PERMISSOES_DA_JANELA_DE_MIGRACAO,
  PERMISSOES_DA_PROVIDENCIA,
  PERMISSOES_DA_RECLASSIFICACAO,
  PERMISSOES_DA_REVISAO,
  PERMISSOES_DAS_TELAS,
} from '../../acesso/permissoes-das-telas';
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
        path: 'providencias',
        canActivate: [permissaoGuard(...PERMISSOES_DA_PROVIDENCIA)],
        data: { breadcrumb: 'Providências sobre concessões' },
        loadComponent: () =>
          import('./providencias/providencias.page').then((m) => m.ProvidenciasPage),
      },
      {
        path: 'providencias/:id',
        canActivate: [permissaoGuard(...PERMISSOES_DA_PROVIDENCIA)],
        data: { breadcrumb: 'Providência' },
        loadComponent: () =>
          import('./providencias/providencia-detalhe.page').then((m) => m.ProvidenciaDetalhePage),
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
        data: { breadcrumb: 'Fila do Representante do controlador', fila: 'protecao_de_dados' },
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
        path: 'concessoes/:id',
        canActivate: [permissaoGuard(...PERMISSOES_DA_CONCESSAO)],
        data: { breadcrumb: 'Concessão de acesso' },
        loadComponent: () => import('./concessao-detalhe.page').then((m) => m.ConcessaoDetalhePage),
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
        data: {
          breadcrumb: 'Janelas de migração na gestão de acessos',
          etapa: 'gestao_de_acessos',
        },
        loadComponent: () =>
          import('./janela/fila-de-janelas.page').then((m) => m.FilaDeJanelasPage),
      },
      {
        path: 'janelas-de-migracao/protecao-de-dados',
        canActivate: [
          permissaoGuard(...PERMISSOES_DAS_TELAS['acessos/janelas-de-migracao/protecao-de-dados']),
        ],
        data: {
          breadcrumb: 'Janelas de migração na proteção de dados',
          etapa: 'protecao_de_dados',
        },
        loadComponent: () =>
          import('./janela/fila-de-janelas.page').then((m) => m.FilaDeJanelasPage),
      },
      {
        path: 'reclassificacoes/gestao-de-acessos',
        canActivate: [
          permissaoGuard(...PERMISSOES_DAS_TELAS['acessos/reclassificacoes/gestao-de-acessos']),
        ],
        data: { breadcrumb: 'Reclassificações na gestão de acessos', etapa: 'gestao_de_acessos' },
        loadComponent: () =>
          import('./reclassificacao/fila-de-reclassificacoes.page').then(
            (m) => m.FilaDeReclassificacoesPage,
          ),
      },
      {
        path: 'reclassificacoes/protecao-de-dados',
        canActivate: [
          permissaoGuard(...PERMISSOES_DAS_TELAS['acessos/reclassificacoes/protecao-de-dados']),
        ],
        data: { breadcrumb: 'Reclassificações na proteção de dados', etapa: 'protecao_de_dados' },
        loadComponent: () =>
          import('./reclassificacao/fila-de-reclassificacoes.page').then(
            (m) => m.FilaDeReclassificacoesPage,
          ),
      },
      {
        path: 'reclassificacoes/:id',
        canActivate: [permissaoGuard(...PERMISSOES_DA_RECLASSIFICACAO)],
        data: { breadcrumb: 'Reclassificação' },
        loadComponent: () =>
          import('./reclassificacao/reclassificacao-detalhe.page').then(
            (m) => m.ReclassificacaoDetalhePage,
          ),
      },
      {
        path: 'governanca/divergencias',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['acessos/governanca/divergencias'])],
        data: { breadcrumb: 'Divergências da governança' },
        loadComponent: () =>
          import('./reclassificacao/divergencias-da-governanca.page').then(
            (m) => m.DivergenciasDaGovernancaPage,
          ),
      },
      {
        path: 'termo-de-responsabilidade',
        canActivate: [
          permissaoGuard(...PERMISSOES_DAS_TELAS['acessos/termo-de-responsabilidade']),
        ],
        data: { breadcrumb: 'Termo de responsabilidade' },
        loadComponent: () =>
          import('./termo/publicacao-do-termo.page').then((m) => m.PublicacaoDoTermoPage),
      },
      {
        path: 'revisoes',
        canActivate: [permissaoGuard(...PERMISSOES_DA_REVISAO)],
        data: { breadcrumb: 'Revisões de acesso' },
        loadComponent: () => import('./revisoes/revisoes.page').then((m) => m.RevisoesPage),
      },
      {
        path: 'revisoes/:id',
        canActivate: [permissaoGuard(...PERMISSOES_DA_REVISAO)],
        data: { breadcrumb: 'Revisão de acessos' },
        loadComponent: () =>
          import('./revisoes/revisao-detalhe.page').then((m) => m.RevisaoDetalhePage),
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
      {
        path: 'perfis/:id/versoes/:versaoId',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['acessos/perfis'])],
        data: { breadcrumb: 'Versão do perfil de acesso' },
        loadComponent: () =>
          import('./versoes/perfil-detalhe.page').then((m) => m.PerfilDetalhePage),
      },
    ],
  },
];
