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
    // Área pública do portal — shell próprio (ADR-0023 §2), sem menu lateral,
    // com rolagem natural da página (header e rodapé acompanham o scroll).
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
    ],
  },
  {
    path: '',
    loadComponent: () => import('./layout/layout').then((m) => m.LayoutComponent),
    children: [
      {
        // Áreas autenticadas do candidato — exigem authGuard.
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
        path: 'recursos',
        canActivate: [authGuard],
        loadChildren: () =>
          import('./features/recursos/recursos.routes').then((m) => m.RECURSOS_ROUTES),
      },
      {
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
  { path: '**', redirectTo: '' },
];
