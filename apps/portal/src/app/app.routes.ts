import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout';

export const appRoutes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', redirectTo: 'processos', pathMatch: 'full' },
      {
        path: 'processos',
        loadChildren: () => import('./features/processos/processos.routes').then((m) => m.PROCESSOS_ROUTES),
      },
      {
        path: 'inscricao',
        loadChildren: () => import('./features/inscricao/inscricao.routes').then((m) => m.INSCRICAO_ROUTES),
      },
      {
        path: 'acompanhamento',
        loadChildren: () => import('./features/acompanhamento/acompanhamento.routes').then((m) => m.ACOMPANHAMENTO_ROUTES),
      },
      {
        path: 'recursos',
        loadChildren: () => import('./features/recursos/recursos.routes').then((m) => m.RECURSOS_ROUTES),
      },
      {
        path: 'documentos',
        loadChildren: () => import('./features/documentos/documentos.routes').then((m) => m.DOCUMENTOS_ROUTES),
      },
      {
        path: 'perfil',
        loadChildren: () => import('./features/perfil/perfil.routes').then((m) => m.PERFIL_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
