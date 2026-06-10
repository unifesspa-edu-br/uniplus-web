import { Routes } from '@angular/router';
import { AccessDeniedComponent } from '@uniplus/shared-auth/components';
import { authGuard, roleGuard } from '@uniplus/shared-auth/guards';

export const appRoutes: Routes = [
  {
    path: 'acesso-negado',
    component: AccessDeniedComponent,
  },
  {
    path: '',
    loadComponent: () => import('./layout/layout').then((m) => m.LayoutComponent),
    canActivate: [authGuard, roleGuard('plataforma-admin')],
    children: [
      { path: '', redirectTo: 'unidades', pathMatch: 'full' },
      {
        path: 'unidades',
        loadChildren: () =>
          import('./features/unidades/unidades.routes').then((m) => m.UNIDADES_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
