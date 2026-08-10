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
      {
        path: 'pesos-enem',
        data: { breadcrumb: 'Peso ENEM' },
        loadChildren: () =>
          import('./features/pesos-enem/pesos-enem.routes').then((m) => m.PESOS_ENEM_ROUTES),
      },
      {
        path: 'cursos',
        data: { breadcrumb: 'Curso' },
        loadChildren: () => import('./features/cursos/cursos.routes').then((m) => m.CURSOS_ROUTES),
      },
      {
        path: 'ofertas-curso',
        data: { breadcrumb: 'Oferta de curso' },
        loadChildren: () =>
          import('./features/ofertas-curso/ofertas-curso.routes').then(
            (m) => m.OFERTAS_CURSO_ROUTES,
          ),
      },
      {
        path: 'modalidades',
        data: { breadcrumb: 'Modalidade' },
        loadChildren: () =>
          import('./features/modalidades/modalidades.routes').then((m) => m.MODALIDADES_ROUTES),
      },
      {
        path: 'fases-canonicas',
        data: { breadcrumb: 'Fase Canônica' },
        loadChildren: () =>
          import('./features/fases-canonicas/fases-canonicas.routes').then(
            (m) => m.FASES_CANONICAS_ROUTES,
          ),
      },
      {
        path: 'precedencias-fase',
        data: { breadcrumb: 'Precedência de Fase' },
        loadChildren: () =>
          import('./features/precedencias-fase/precedencias-fase.routes').then(
            (m) => m.PRECEDENCIAS_FASE_ROUTES,
          ),
      },
      {
        path: 'tipos-banca',
        data: { breadcrumb: 'Tipo de Banca' },
        loadChildren: () =>
          import('./features/tipos-banca/tipos-banca.routes').then((m) => m.TIPOS_BANCA_ROUTES),
      },
      {
        path: 'tipos-documento',
        data: { breadcrumb: 'Tipo de Documento' },
        loadChildren: () =>
          import('./features/tipos-documento/tipos-documento.routes').then(
            (m) => m.TIPOS_DOCUMENTO_ROUTES,
          ),
      },
      {
        path: 'condicoes-atendimento',
        data: { breadcrumb: 'Condições de Atendimento' },
        loadChildren: () =>
          import('./features/condicoes-atendimento/condicoes-atendimento.routes').then(
            (m) => m.CONDICOES_ATENDIMENTO,
          ),
      },
      {
        path: 'recursos-acessibilidade',
        data: { breadcrumb: 'Recursos de Acessibilidade' },
        loadChildren: () =>
          import('./features/recursos-acessibilidade/recurso-acessibilidade.routes').then(
            (m) => m.RECURSOS_ACESSIBILIDADE,
          ),
      },
      {
        path: 'tipos-deficiencia',
        data: { breadcrumb: 'Tipos de Deficiência' },
        loadChildren: () =>
          import('./features/tipos-deficiencia/tipos-deficiencia.route').then(
            (m) => m.TIPOS_DEFICIENCIA_ROUTES,
          ),
      },
      {
        path: 'termos-consentimento',
        data: { breadcrumb: 'Termos de Consentimento' },
        loadChildren: () =>
          import('./features/termos-consentimento/termos-consentimento.routes').then(
            (m) => m.TERMOS_CONSENTIMENTO_ROUTES,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
