export const CategoriaDaRemocao = {
  INCIDENTE: 'INCIDENTE',
  ERRO_DE_COMPOSICAO: 'ERRO_DE_COMPOSICAO',
  MUDANCA_DE_FUNCAO: 'MUDANCA_DE_FUNCAO',
} as const;
export type CategoriaDaRemocao = (typeof CategoriaDaRemocao)[keyof typeof CategoriaDaRemocao];

export const CausaDoEncerramento = {
  REVOGADA: 'REVOGADA',
  VENCIDA: 'VENCIDA',
} as const;
export type CausaDoEncerramento = (typeof CausaDoEncerramento)[keyof typeof CausaDoEncerramento];

export const EtapaDaMigracao = {
  GESTAO_DE_ACESSOS: 'GESTAO_DE_ACESSOS',
  PROTECAO_DE_DADOS: 'PROTECAO_DE_DADOS',
  SISTEMA: 'SISTEMA',
} as const;
export type EtapaDaMigracao = (typeof EtapaDaMigracao)[keyof typeof EtapaDaMigracao];

export const EtapaDaVersao = {
  GESTAO_DE_ACESSOS: 'GESTAO_DE_ACESSOS',
  PROTECAO_DE_DADOS: 'PROTECAO_DE_DADOS',
} as const;
export type EtapaDaVersao = (typeof EtapaDaVersao)[keyof typeof EtapaDaVersao];

export const EtapaDoPedido = {
  GESTOR: 'GESTOR',
  PROTECAO_DE_DADOS: 'PROTECAO_DE_DADOS',
} as const;
export type EtapaDoPedido = (typeof EtapaDoPedido)[keyof typeof EtapaDoPedido];

export const OrigemDaRetomada = {
  DECISAO_DA_ETAPA: 'DECISAO_DA_ETAPA',
  TROCA_DE_VIGENCIA: 'TROCA_DE_VIGENCIA',
  RECLASSIFICACAO: 'RECLASSIFICACAO',
} as const;
export type OrigemDaRetomada = (typeof OrigemDaRetomada)[keyof typeof OrigemDaRetomada];

export const OrigemDaVersao = {
  PROPOSTA: 'PROPOSTA',
  REMOCAO: 'REMOCAO',
} as const;
export type OrigemDaVersao = (typeof OrigemDaVersao)[keyof typeof OrigemDaVersao];

export const OrigemDoAviso = {
  RECLASSIFICACAO: 'RECLASSIFICACAO',
  DIVERGENCIA: 'DIVERGENCIA',
} as const;
export type OrigemDoAviso = (typeof OrigemDoAviso)[keyof typeof OrigemDoAviso];

export const ResultadoDaDecisao = {
  APROVADO: 'APROVADO',
  RECUSADO: 'RECUSADO',
  PERFIL_ALTERADO: 'PERFIL_ALTERADO',
  PRAZO_VENCIDO: 'PRAZO_VENCIDO',
  TERMO_EXIGIDO: 'TERMO_EXIGIDO',
} as const;
export type ResultadoDaDecisao = (typeof ResultadoDaDecisao)[keyof typeof ResultadoDaDecisao];

export const ResultadoDaLiberacao = {
  LIBERADA: 'LIBERADA',
  MANTIDA: 'MANTIDA',
} as const;
export type ResultadoDaLiberacao = (typeof ResultadoDaLiberacao)[keyof typeof ResultadoDaLiberacao];

export const ResultadoDaMigracao = {
  MIGRAR: 'MIGRAR',
  RECUSAR: 'RECUSAR',
  RETER: 'RETER',
  NAO_MIGRADA: 'NAO_MIGRADA',
  FORA_DA_LISTA: 'FORA_DA_LISTA',
} as const;
export type ResultadoDaMigracao = (typeof ResultadoDaMigracao)[keyof typeof ResultadoDaMigracao];

export const ResultadoDoItemDaRevisao = {
  CONFIRMADA: 'CONFIRMADA',
  REVOGADA: 'REVOGADA',
} as const;
export type ResultadoDoItemDaRevisao =
  (typeof ResultadoDoItemDaRevisao)[keyof typeof ResultadoDoItemDaRevisao];

export const SituacaoDaInstalacao = {
  AGUARDANDO_DOCUMENTO: 'AGUARDANDO_DOCUMENTO',
  DOCUMENTO_EM_VERIFICACAO: 'DOCUMENTO_EM_VERIFICACAO',
  DOCUMENTO_VERIFICADO: 'DOCUMENTO_VERIFICADO',
  DOCUMENTO_RECUSADO: 'DOCUMENTO_RECUSADO',
  AGUARDANDO_CODIGO: 'AGUARDANDO_CODIGO',
  CONFIRMADA: 'CONFIRMADA',
  CANCELADA: 'CANCELADA',
  EXPIRADA: 'EXPIRADA',
} as const;
export type SituacaoDaInstalacao = (typeof SituacaoDaInstalacao)[keyof typeof SituacaoDaInstalacao];

export const SituacaoDaVersao = {
  PENDENTE: 'PENDENTE',
  VIGENTE: 'VIGENTE',
  ENCERRADA: 'ENCERRADA',
  CANCELADA: 'CANCELADA',
  RECUSADA: 'RECUSADA',
  EXPIRADA: 'EXPIRADA',
} as const;
export type SituacaoDaVersao = (typeof SituacaoDaVersao)[keyof typeof SituacaoDaVersao];

export const SituacaoDoAnexo = {
  AGUARDANDO_ENVIO: 'AGUARDANDO_ENVIO',
  EM_VERIFICACAO: 'EM_VERIFICACAO',
  VERIFICADO: 'VERIFICADO',
  RECUSADO: 'RECUSADO',
} as const;
export type SituacaoDoAnexo = (typeof SituacaoDoAnexo)[keyof typeof SituacaoDoAnexo];

export const TipoDaProvidencia = {
  RETIRADA: 'RETIRADA',
  REVISAO: 'REVISAO',
} as const;
export type TipoDaProvidencia = (typeof TipoDaProvidencia)[keyof typeof TipoDaProvidencia];

export const TipoDeDivergencia = {
  COMPOSICAO_FALTANTE: 'COMPOSICAO_FALTANTE',
  COMPOSICAO_EXCEDENTE: 'COMPOSICAO_EXCEDENTE',
  CLASSIFICACAO: 'CLASSIFICACAO',
  ESCOPO: 'ESCOPO',
} as const;
export type TipoDeDivergencia = (typeof TipoDeDivergencia)[keyof typeof TipoDeDivergencia];

export const TipoDeEscopo = {
  UNIDADE: 'UNIDADE',
  INSTITUICAO: 'INSTITUICAO',
} as const;
export type TipoDeEscopo = (typeof TipoDeEscopo)[keyof typeof TipoDeEscopo];

export const TipoDeGovernanca = {
  GESTOR_DE_ACESSOS: 'GESTOR_DE_ACESSOS',
  REPRESENTANTE_DO_CONTROLADOR: 'REPRESENTANTE_DO_CONTROLADOR',
  GESTOR_DE_PROTECAO_DE_DADOS: 'GESTOR_DE_PROTECAO_DE_DADOS',
} as const;
export type TipoDeGovernanca = (typeof TipoDeGovernanca)[keyof typeof TipoDeGovernanca];

export const TipoDeOrigem = {
  PEDIDO: 'PEDIDO',
  INSTALACAO: 'INSTALACAO',
} as const;
export type TipoDeOrigem = (typeof TipoDeOrigem)[keyof typeof TipoDeOrigem];

export const TipoDoEventoDaContencao = {
  SUSPENSAO: 'SUSPENSAO',
  RETOMADA: 'RETOMADA',
  DESATIVACAO: 'DESATIVACAO',
  REATIVACAO: 'REATIVACAO',
} as const;
export type TipoDoEventoDaContencao =
  (typeof TipoDoEventoDaContencao)[keyof typeof TipoDoEventoDaContencao];

export const AtorDoEventoDaContencao = {
  HUMANO: 'HUMANO',
  SISTEMA: 'SISTEMA',
} as const;
export type AtorDoEventoDaContencao =
  (typeof AtorDoEventoDaContencao)[keyof typeof AtorDoEventoDaContencao];

export const SituacaoDoItemDaRevisao = {
  PENDENTE: 'PENDENTE',
  CONFIRMADA: 'CONFIRMADA',
  REVOGADA: 'REVOGADA',
  CONCESSAO_ENCERRADA: 'CONCESSAO_ENCERRADA',
} as const;
export type SituacaoDoItemDaRevisao =
  (typeof SituacaoDoItemDaRevisao)[keyof typeof SituacaoDoItemDaRevisao];

export const QuemDecideOItem = {
  REPRESENTANTE_DO_CONTROLADOR: 'REPRESENTANTE_DO_CONTROLADOR',
  GESTOR_DE_ACESSOS: 'GESTOR_DE_ACESSOS',
} as const;
export type QuemDecideOItem = (typeof QuemDecideOItem)[keyof typeof QuemDecideOItem];

export type DecisaoDaMigracao =
  | typeof ResultadoDaMigracao.MIGRAR
  | typeof ResultadoDaMigracao.RECUSAR;
export type ResultadoDaReclassificacao = ResultadoDaLiberacao;
