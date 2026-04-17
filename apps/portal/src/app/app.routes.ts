import { Routes } from '@angular/router';
import { AccessDeniedComponent, authGuard } from '@uniplus/shared-auth';
import { LayoutComponent } from './layout/layout';

export const appRoutes: Routes = [
  {
    path: 'acesso-negado',
    component: AccessDeniedComponent,
  },
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', redirectTo: 'processos', pathMatch: 'full' },
      {
        // Consulta pública de processos seletivos — sem autenticação.
        path: 'processos',
        loadChildren: () => import('./features/processos/processos.routes').then((m) => m.PROCESSOS_ROUTES),
      },
      {
        // Áreas autenticadas do candidato — exigem authGuard.
        path: 'inscricao',
        canActivate: [authGuard],
        loadChildren: () => import('./features/inscricao/inscricao.routes').then((m) => m.INSCRICAO_ROUTES),
      },
      {
        path: 'acompanhamento',
        canActivate: [authGuard],
        loadChildren: () => import('./features/acompanhamento/acompanhamento.routes').then((m) => m.ACOMPANHAMENTO_ROUTES),
      },
      {
        path: 'recursos',
        canActivate: [authGuard],
        loadChildren: () => import('./features/recursos/recursos.routes').then((m) => m.RECURSOS_ROUTES),
      },
      {
        path: 'documentos',
        canActivate: [authGuard],
        loadChildren: () => import('./features/documentos/documentos.routes').then((m) => m.DOCUMENTOS_ROUTES),
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
