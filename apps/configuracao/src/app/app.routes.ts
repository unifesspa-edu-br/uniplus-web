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
        data: { breadcrumb: 'Unidade' },
        loadChildren: () =>
          import('./features/unidades/unidades.routes').then((m) => m.UNIDADES_ROUTES),
      },
      {
        path: 'instituicao',
        data: { breadcrumb: 'Instituição' },
        loadChildren: () =>
          import('./features/instituicao/instituicao.routes').then((m) => m.INSTITUICAO_ROUTES),
      },
      {
        path: 'campi',
        data: { breadcrumb: 'Campus' },
        loadChildren: () => import('./features/campi/campi.routes').then((m) => m.CAMPI_ROUTES),
      },
      {
        path: 'locais-oferta',
        data: { breadcrumb: 'Local de oferta' },
        loadChildren: () =>
          import('./features/locais-oferta/locais-oferta.routes').then(
            (m) => m.LOCAIS_OFERTA_ROUTES,
          ),
      },
      {
        path: 'reserva-demografica',
        data: { breadcrumb: 'Reserva Demográfica' },
        loadChildren: () =>
          import('./features/reserva-demografica/reserva-demografica.routes').then(
            (m) => m.RESERVA_DEMOGRAFICA_ROUTES,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
