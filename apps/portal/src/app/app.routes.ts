import { Routes } from '@angular/router';
import { AccessDeniedComponent } from '@uniplus/shared-auth/components';
import { authGuard } from '@uniplus/shared-auth/guards';

export const appRoutes: Routes = [
  {
    path: 'acesso-negado',
    component: AccessDeniedComponent,
    // A raiz do portal leva à consulta pública de processos, alcançável sem
    // autenticação — aqui existe volta, ao contrário dos apps administrativos,
    // onde a raiz é protegida pelo mesmo guard que traz o usuário até esta tela.
    data: { rotaDeVolta: '/processos' },
  },
  { path: '', pathMatch: 'full', redirectTo: 'processos' },
  {
    // Área pública do portal — shell próprio (ADR-0023 §2), sem menu lateral.
    // Faixa institucional, topo e navegação por abas ficam fixos; só
    // main + rodapé rolam, num contêiner próprio (ver PortalShellComponent).
    path: '',
    loadComponent: () => import('./layout/portal-shell').then((m) => m.PortalShellComponent),
    children: [
      {
        // Consulta pública de processos seletivos — sem autenticação. Traz o
        // destaque de hero e a lista de certames (issue #779) na mesma tela.
        path: 'processos',
        loadChildren: () =>
          import('./features/processos/processos.routes').then((m) => m.PROCESSOS_ROUTES),
      },
      {
        // Publicações — lista pública dos processos seletivos ainda não
        // finalizados e o detalhe/linha do tempo de cada um (menu
        // "Publicações"). Mesmo motivo de "processos": consulta sem
        // autenticação, dado mocado por ora (ver publicacoes.mock.ts).
        path: 'publicacoes',
        loadChildren: () =>
          import('./features/publicacoes/publicacoes.routes').then((m) => m.PUBLICACOES_ROUTES),
      },
      {
        // "Minhas inscrições" e "Resultados" ficam no shell público, como o
        // resto da navegação do topo — exigem authGuard mesmo aqui, o shell
        // em si continua sem restrição de rota.
        path: 'inscricao',
        canActivate: [authGuard],
        loadChildren: () =>
          import('./features/inscricao/inscricao.routes').then((m) => m.INSCRICAO_ROUTES),
      },
      {
        path: 'acompanhamento',
        canActivate: [authGuard],
        loadChildren: () =>
          import('./features/acompanhamento/acompanhamento.routes').then(
            (m) => m.ACOMPANHAMENTO_ROUTES,
          ),
      },
      {
        // Mesmo motivo de inscricao/acompanhamento: mesma largura e cabeçalho
        // fixo do resto do shell público, em vez do layout administrativo.
        path: 'documentos',
        canActivate: [authGuard],
        loadChildren: () =>
          import('./features/documentos/documentos.routes').then((m) => m.DOCUMENTOS_ROUTES),
      },
      {
        path: 'perfil',
        canActivate: [authGuard],
        loadChildren: () => import('./features/perfil/perfil.routes').then((m) => m.PERFIL_ROUTES),
      },
    ],
  },
  {
    path: '',
    loadComponent: () => import('./layout/layout').then((m) => m.LayoutComponent),
    children: [
      {
        // Único remanescente do shell administrativo — sem link em nenhum
        // menu hoje (situação anterior a esta mudança, não introduzida por
        // ela). Só alcançável por URL direta.
        path: 'recursos',
        canActivate: [authGuard],
        loadChildren: () =>
          import('./features/recursos/recursos.routes').then((m) => m.RECURSOS_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
