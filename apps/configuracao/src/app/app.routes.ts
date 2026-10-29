import { Routes } from '@angular/router';
import { AccessDeniedComponent } from '@uniplus/shared-auth/components';
import { authGuard, permissaoGuard } from '@uniplus/shared-auth/guards';
import { PERMISSOES_DAS_TELAS, entradaPelaPermissao } from './acesso/permissoes-das-telas';

export const appRoutes: Routes = [
  {
    path: 'acesso-negado',
    component: AccessDeniedComponent,
    data: { rotaDeVolta: '/acessos/pedidos/novo', rotuloDaRotaDeVolta: 'Pedir acesso' },
  },
  {
    path: '',
    loadComponent: () => import('./layout/layout').then((m) => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', canActivate: [entradaPelaPermissao], children: [] },
      {
        path: 'acessos',
        data: { breadcrumb: 'Acesso' },
        loadChildren: () =>
          import('./features/acessos/acessos.routes').then((m) => m.ACESSOS_ROUTES),
      },
      {
        path: 'unidades',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['unidades'])],
        data: { breadcrumb: 'Unidade' },
        loadChildren: () =>
          import('./features/unidades/unidades.routes').then((m) => m.UNIDADES_ROUTES),
      },
      {
        path: 'instituicao',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['instituicao'])],
        data: { breadcrumb: 'Instituição' },
        loadChildren: () =>
          import('./features/instituicao/instituicao.routes').then((m) => m.INSTITUICAO_ROUTES),
      },
      {
        path: 'campi',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['campi'])],
        data: { breadcrumb: 'Campus' },
        loadChildren: () => import('./features/campi/campi.routes').then((m) => m.CAMPI_ROUTES),
      },
      {
        path: 'locais-oferta',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['locais-oferta'])],
        data: { breadcrumb: 'Local de oferta' },
        loadChildren: () =>
          import('./features/locais-oferta/locais-oferta.routes').then(
            (m) => m.LOCAIS_OFERTA_ROUTES,
          ),
      },
      {
        path: 'reserva-demografica',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['reserva-demografica'])],
        data: { breadcrumb: 'Reserva Demográfica' },
        loadChildren: () =>
          import('./features/reserva-demografica/reserva-demografica.routes').then(
            (m) => m.RESERVA_DEMOGRAFICA_ROUTES,
          ),
      },
      {
        path: 'pesos-por-area',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['pesos-por-area'])],
        data: { breadcrumb: 'Peso por Área' },
        loadChildren: () =>
          import('./features/pesos-enem/pesos-enem.routes').then((m) => m.PESOS_ENEM_ROUTES),
      },
      {
        path: 'cursos',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['cursos'])],
        data: { breadcrumb: 'Curso' },
        loadChildren: () => import('./features/cursos/cursos.routes').then((m) => m.CURSOS_ROUTES),
      },
      {
        path: 'ofertas-curso',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['ofertas-curso'])],
        data: { breadcrumb: 'Oferta de curso' },
        loadChildren: () =>
          import('./features/ofertas-curso/ofertas-curso.routes').then(
            (m) => m.OFERTAS_CURSO_ROUTES,
          ),
      },
      {
        path: 'modalidades',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['modalidades'])],
        data: { breadcrumb: 'Modalidade' },
        loadChildren: () =>
          import('./features/modalidades/modalidades.routes').then((m) => m.MODALIDADES_ROUTES),
      },
      {
        path: 'fases-canonicas',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['fases-canonicas'])],
        data: { breadcrumb: 'Fase Canônica' },
        loadChildren: () =>
          import('./features/fases-canonicas/fases-canonicas.routes').then(
            (m) => m.FASES_CANONICAS_ROUTES,
          ),
      },
      {
        path: 'precedencias-fase',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['precedencias-fase'])],
        data: { breadcrumb: 'Precedência de Fase' },
        loadChildren: () =>
          import('./features/precedencias-fase/precedencias-fase.routes').then(
            (m) => m.PRECEDENCIAS_FASE_ROUTES,
          ),
      },
      {
        path: 'tipos-banca',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['tipos-banca'])],
        data: { breadcrumb: 'Tipo de Banca' },
        loadChildren: () =>
          import('./features/tipos-banca/tipos-banca.routes').then((m) => m.TIPOS_BANCA_ROUTES),
      },
      {
        path: 'tipos-etapa',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['tipos-etapa'])],
        data: { breadcrumb: 'Tipo de Etapa' },
        loadChildren: () =>
          import('./features/tipos-etapa/tipos-etapa.routes').then((m) => m.TIPOS_ETAPA_ROUTES),
      },
      {
        path: 'tipos-processo',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['tipos-processo'])],
        data: { breadcrumb: 'Tipo de Processo' },
        loadChildren: () =>
          import('./features/tipos-processo/tipos-processo.routes').then(
            (m) => m.TIPOS_PROCESSO_ROUTES,
          ),
      },
      {
        path: 'tipos-ato',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['tipos-ato'])],
        data: { breadcrumb: 'Tipo de Ato' },
        loadChildren: () =>
          import('./features/tipos-ato/tipos-ato.routes').then((m) => m.TIPOS_ATO_ROUTES),
      },
      {
        path: 'fatos-candidato',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['fatos-candidato'])],
        data: { breadcrumb: 'Fato do Candidato' },
        loadChildren: () =>
          import('./features/fatos-candidato/fatos-candidato.routes').then(
            (m) => m.FATOS_CANDIDATO_ROUTES,
          ),
      },
      {
        path: 'modelos-formulario',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['modelos-formulario'])],
        data: { breadcrumb: 'Modelo de Formulário' },
        loadChildren: () =>
          import('./features/modelos-formulario/modelos-formulario.routes').then(
            (m) => m.MODELOS_FORMULARIO_ROUTES,
          ),
      },
      {
        path: 'simulador-de-formulario',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['simulador-de-formulario'])],
        data: { breadcrumb: 'Simulador de Formulário' },
        loadChildren: () =>
          import('./features/simulador-de-formulario/simulador-de-formulario.routes').then(
            (m) => m.SIMULADOR_DE_FORMULARIO_ROUTES,
          ),
      },
      {
        path: 'tipos-documento',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['tipos-documento'])],
        data: { breadcrumb: 'Tipo de Documento' },
        loadChildren: () =>
          import('./features/tipos-documento/tipos-documento.routes').then(
            (m) => m.TIPOS_DOCUMENTO_ROUTES,
          ),
      },
      {
        path: 'base-legal-bonus-regional',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['base-legal-bonus-regional'])],
        data: { breadcrumb: 'Base Legal de Bônus Regional' },
        loadChildren: () =>
          import('./features/base-legal-bonus-regional/base-legal-bonus-regional.routes').then(
            (m) => m.BASE_LEGAL_BONUS_REGIONAL_ROUTES,
          ),
      },
      {
        path: 'condicoes-atendimento',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['condicoes-atendimento'])],
        data: { breadcrumb: 'Condições de Atendimento' },
        loadChildren: () =>
          import('./features/condicoes-atendimento/condicoes-atendimento.routes').then(
            (m) => m.CONDICOES_ATENDIMENTO,
          ),
      },
      {
        path: 'recursos-acessibilidade',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['recursos-acessibilidade'])],
        data: { breadcrumb: 'Recursos de Acessibilidade' },
        loadChildren: () =>
          import('./features/recursos-acessibilidade/recurso-acessibilidade.routes').then(
            (m) => m.RECURSOS_ACESSIBILIDADE,
          ),
      },
      {
        path: 'tipos-deficiencia',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['tipos-deficiencia'])],
        data: { breadcrumb: 'Tipos de Deficiência' },
        loadChildren: () =>
          import('./features/tipos-deficiencia/tipos-deficiencia.route').then(
            (m) => m.TIPOS_DEFICIENCIA_ROUTES,
          ),
      },
      {
        path: 'termos-consentimento',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['termos-consentimento'])],
        data: { breadcrumb: 'Termos de Consentimento' },
        loadChildren: () =>
          import('./features/termos-consentimento/termos-consentimento.routes').then(
            (m) => m.TERMOS_CONSENTIMENTO_ROUTES,
          ),
      },
      {
        path: 'calendario-dias-uteis',
        canActivate: [permissaoGuard(...PERMISSOES_DAS_TELAS['calendario-dias-uteis'])],
        data: { breadcrumb: 'Calendário Dias Úteis' },
        loadChildren: () =>
          import('./features/calendario-dias-uteis/calendario-dias-uteis.routes').then(
            (m) => m.CALENDARIO_DIAS_UTEIS_ROUTES,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
