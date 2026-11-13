/**
 * Permissões que a interface da Configuração consulta, por persona fictícia do portal. O catálogo
 * é o da API (`PermissaoConfiguracao`, `PermissaoOrganizacao`, `PermissaoPublicacoes`).
 */
export const TODAS_AS_PERMISSOES_DA_CONFIGURACAO = [
  'organizacao:unidades:manter',
  'organizacao:instituicao:manter',
  'configuracao:campi:manter',
  'configuracao:locais-oferta:manter',
  'configuracao:referencias-reserva-demografica:manter',
  'configuracao:pesos-area-enem:manter',
  'configuracao:cursos:manter',
  'configuracao:ofertas-curso:manter',
  'configuracao:modalidades:manter',
  'configuracao:fases-canonicas:manter',
  'configuracao:precedencias-fase:manter',
  'configuracao:tipos-banca:manter',
  'configuracao:tipos-etapa:manter',
  'configuracao:tipos-processo:manter',
  'configuracao:tipos-processo:consultar',
  'publicacoes:tipos-ato:manter',
  'configuracao:fatos-candidato:manter',
  'configuracao:fatos-candidato:consultar',
  'configuracao:modelos-formulario:manter',
  'configuracao:modelos-formulario:consultar',
  'configuracao:tipos-documento:manter',
  'configuracao:protecao-do-catalogo:aprovar',
  'configuracao:base-legal-bonus-regional:manter',
  'configuracao:condicoes-atendimento:manter',
  'configuracao:recursos-acessibilidade:manter',
  'configuracao:tipos-deficiencia:manter',
  'configuracao:termos-consentimento:manter',
  'configuracao:calendarios-dias-uteis:manter',
] as const;

/** Leandro mantém campi, unidades e tipos de processo. */
export const PERMISSOES_DO_LEANDRO = [
  'configuracao:campi:manter',
  'organizacao:unidades:manter',
  'configuracao:tipos-processo:consultar',
  'configuracao:tipos-processo:manter',
] as const;

/** Betina só consulta os tipos de processo: não mantém nada. */
export const PERMISSOES_DA_BETINA = ['configuracao:tipos-processo:consultar'] as const;

/** Diogo é gestor de acessos: aprova a etapa funcional, administra concessões e mantém perfis. */
export const PERMISSOES_DO_DIOGO = [
  'autorizacao:pedidos:aprovar-funcional',
  'autorizacao:concessoes:administrar',
  'autorizacao:perfis:manter',
] as const;

/** Betina é Representante do controlador: aprova a etapa de proteção de dados. */
export const PERMISSOES_DA_BETINA_REPRESENTANTE = [
  'autorizacao:pedidos:aprovar-protecao-de-dados',
] as const;

/** Diogo só aprova pela gestão de acessos: não mantém perfis nem aprova pela proteção de dados. */
export const PERMISSOES_DO_DIOGO_SO_APROVA = ['autorizacao:perfis:aprovar-funcional'] as const;

/** Betina só aprova pela proteção de dados. */
export const PERMISSOES_DA_BETINA_SO_APROVA = [
  'autorizacao:perfis:aprovar-protecao-de-dados',
] as const;

/** Quem aprova pelas duas etapas escolhe, na decisão, por qual delas decide. */
export const PERMISSOES_DAS_DUAS_ETAPAS = [
  ...PERMISSOES_DO_DIOGO_SO_APROVA,
  ...PERMISSOES_DA_BETINA_SO_APROVA,
] as const;

/** Betina, Representante do controlador, conduz a revisão periódica e decide os itens comuns. */
export const PERMISSOES_DA_BETINA_CONDUZ_REVISOES = ['autorizacao:revisoes:conduzir'] as const;

/** Diogo, gestor de acessos, revê os itens de quem é Representante do controlador. */
export const PERMISSOES_DO_DIOGO_REVE_REVISOES = [
  'autorizacao:revisoes:rever-protecao-de-dados',
] as const;

/**
 * Isabella, Encarregado de dados, só consulta as revisões e as concessões.
 */
export const PERMISSOES_DA_ISABELLA_CONSULTA_REVISOES = [
  'autorizacao:revisoes:consultar',
  'autorizacao:concessoes:consultar',
] as const;

/**
 * Isabella, Encarregado de dados, só consulta os pedidos, as concessões e as versões dos perfis:
 * abre as telas de leitura e não decide, revoga, mantém nem pede por ninguém.
 */
export const PERMISSOES_DA_ISABELLA_SO_CONSULTA = [
  'autorizacao:pedidos:consultar',
  'autorizacao:concessoes:consultar',
  'autorizacao:perfis:consultar-versoes',
] as const;

/** Diogo, gestor de acessos, publica as versões do termo de responsabilidade. */
export const PERMISSOES_DO_DIOGO_PUBLICA_O_TERMO = ['autorizacao:termos:publicar'] as const;

/** Kevin, Encarregado de dados, solicita providência sobre concessões e acompanha a dele. */
export const PERMISSOES_DO_KEVIN_SOLICITA_PROVIDENCIA = [
  'autorizacao:providencias:solicitar',
  'autorizacao:concessoes:consultar',
] as const;

/** Diogo, gestor de acessos, administra as concessões: responde e atende as providências. */
export const PERMISSOES_DO_DIOGO_ADMINISTRA_CONCESSOES = [
  'autorizacao:concessoes:administrar',
] as const;

/** Isabella, Encarregado de dados, consulta a proteção dos tipos de documento e dos fatos e se manifesta. */
export const PERMISSOES_DA_ISABELLA_MANIFESTA = [
  'configuracao:protecao-do-catalogo:consultar',
  'configuracao:protecao-do-catalogo:manifestar',
] as const;

/** Betina, Representante do controlador, decide a proteção dos tipos de documento e dos fatos. */
export const PERMISSOES_DA_BETINA_DECIDE_A_PROTECAO = [
  'configuracao:protecao-do-catalogo:aprovar',
] as const;

/** Leandro administra os tipos de documento e consulta os fatos do candidato; não decide a proteção. */
export const PERMISSOES_DO_LEANDRO_ADMINISTRA_TIPOS_E_FATOS = [
  'configuracao:tipos-documento:manter',
  'configuracao:fatos-candidato:consultar',
] as const;
