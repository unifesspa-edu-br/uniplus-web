export interface ItemDoMenu {
  readonly label: string;
  readonly icon: string;
  readonly routerLink?: string;
  readonly exact?: boolean;
}

export interface GrupoDoMenu {
  readonly label: string;
  readonly items: readonly ItemDoMenu[];
}

export const MENU_LATERAL: readonly GrupoDoMenu[] = [
  {
    label: 'Configuração',
    items: [
      { label: 'Campus', icon: 'pi-building', routerLink: '/campi', exact: true },
      { label: 'Local de oferta', icon: 'pi-map', routerLink: '/locais-oferta', exact: true },
      { label: 'Instituição', icon: 'pi-warehouse', routerLink: '/instituicao', exact: true },
      { label: 'Unidade', icon: 'pi-sitemap', routerLink: '/unidades', exact: true },
      { label: 'Curso', icon: 'pi-book', routerLink: '/cursos', exact: true },
      {
        label: 'Oferta de curso',
        icon: 'pi-file-edit',
        routerLink: '/ofertas-curso',
        exact: true,
      },
      { label: 'Modalidade', icon: 'pi-users', routerLink: '/modalidades' },
      {
        label: 'Tipo de Documento',
        icon: 'pi-id-card',
        routerLink: '/tipos-documento',
        exact: true,
      },
      {
        label: 'Proteção de dados dos tipos de documento e dos fatos do candidato',
        icon: 'pi-verified',
        routerLink: '/protecao-do-catalogo',
        exact: true,
      },
      {
        label: 'Fato do Candidato',
        icon: 'pi-list',
        routerLink: '/fatos-candidato',
        exact: true,
      },
      { label: 'Modelo de Formulário', icon: 'pi-file', routerLink: '/modelos-formulario' },
      {
        label: 'Simulador de Formulário',
        icon: 'pi-play',
        routerLink: '/simulador-de-formulario',
      },
      {
        label: 'Termo de Consentimento',
        icon: 'pi-file-edit',
        routerLink: '/termos-consentimento',
      },
      {
        label: 'Condição de Atendimento',
        icon: 'pi-heart',
        routerLink: '/condicoes-atendimento',
      },
      {
        label: 'Recurso de Acessibilidade',
        icon: 'pi-wrench',
        routerLink: '/recursos-acessibilidade',
      },
      { label: 'Tipo de Deficiência', icon: 'pi-stop', routerLink: '/tipos-deficiencia' },
      {
        label: 'Fase Canônica',
        icon: 'pi-star',
        routerLink: '/fases-canonicas',
        exact: true,
      },
      { label: 'Tipo de Banca', icon: 'pi-shield', routerLink: '/tipos-banca', exact: true },
      {
        label: 'Motivos de Decisão',
        icon: 'pi-comments',
        routerLink: '/motivos-de-decisao',
        exact: true,
      },
      { label: 'Tipo de Etapa', icon: 'pi-list-check', routerLink: '/tipos-etapa', exact: true },
      {
        label: 'Tipo de Processo',
        icon: 'pi-flag',
        routerLink: '/tipos-processo',
        exact: true,
      },
      {
        label: 'Tipo de Ato',
        icon: 'pi-megaphone',
        routerLink: '/tipos-ato',
        exact: true,
      },
      {
        label: 'Precedência de Fase',
        icon: 'pi-sort-alt',
        routerLink: '/precedencias-fase',
        exact: true,
      },
      {
        label: 'Reserva Demográfica',
        icon: 'pi-chart-bar',
        routerLink: '/reserva-demografica',
        exact: true,
      },
      {
        label: 'Peso por Área',
        icon: 'pi-sliders-h',
        routerLink: '/pesos-por-area',
        exact: true,
      },
      { label: 'Calendários', icon: 'pi-calendar', routerLink: '/calendario-dias-uteis' },
      {
        label: 'Base legal do Fator de Atenuação',
        icon: 'pi-file-check',
        routerLink: '/bases-legais-fada',
        exact: true,
      },
    ],
  },
  {
    label: 'Acesso',
    items: [
      { label: 'Meus pedidos', icon: 'pi-inbox', routerLink: '/acessos/pedidos' },
      {
        label: 'Providências',
        icon: 'pi-flag',
        routerLink: '/acessos/providencias',
        exact: true,
      },
      {
        label: 'Fila da gestão de acessos',
        icon: 'pi-check-square',
        routerLink: '/acessos/fila-do-gestor',
        exact: true,
      },
      {
        label: 'Fila do Representante do controlador',
        icon: 'pi-shield',
        routerLink: '/acessos/fila-da-protecao-de-dados',
        exact: true,
      },
      {
        label: 'Histórico de pedidos',
        icon: 'pi-history',
        routerLink: '/acessos/historico',
        exact: true,
      },
      { label: 'Concessões', icon: 'pi-key', routerLink: '/acessos/concessoes', exact: true },
      {
        label: 'Perfis de acesso',
        icon: 'pi-id-card',
        routerLink: '/acessos/perfis',
        exact: true,
      },
      {
        label: 'Versões na gestão de acessos',
        icon: 'pi-check-circle',
        routerLink: '/acessos/versoes-de-perfil/gestao-de-acessos',
        exact: true,
      },
      {
        label: 'Versões na proteção de dados',
        icon: 'pi-lock',
        routerLink: '/acessos/versoes-de-perfil/protecao-de-dados',
        exact: true,
      },
      {
        label: 'Revisões das concessões na gestão de acessos',
        icon: 'pi-clock',
        routerLink: '/acessos/janelas-de-migracao/gestao-de-acessos',
        exact: true,
      },
      {
        label: 'Revisões das concessões na proteção de dados',
        icon: 'pi-hourglass',
        routerLink: '/acessos/janelas-de-migracao/protecao-de-dados',
        exact: true,
      },
      {
        label: 'Reclassificações na gestão de acessos',
        icon: 'pi-sync',
        routerLink: '/acessos/reclassificacoes/gestao-de-acessos',
        exact: true,
      },
      {
        label: 'Reclassificações na proteção de dados',
        icon: 'pi-sort-amount-up',
        routerLink: '/acessos/reclassificacoes/protecao-de-dados',
        exact: true,
      },
      {
        label: 'Termo de responsabilidade',
        icon: 'pi-file-edit',
        routerLink: '/acessos/termo-de-responsabilidade',
        exact: true,
      },
      {
        label: 'Revisões de acesso',
        icon: 'pi-calendar',
        routerLink: '/acessos/revisoes',
        exact: true,
      },
      {
        label: 'Divergências da governança',
        icon: 'pi-exclamation-triangle',
        routerLink: '/acessos/governanca/divergencias',
        exact: true,
      },
    ],
  },
];
