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
