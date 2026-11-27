import type { components } from './schema';

type Esquemas = components['schemas'];

export const PARAMETROS_DA_ELIMINACAO = {
  ELIMINACAO_NOTA_MINIMA_ETAPA: 'DocumentoDaConfiguracaoEliminacaoParametrosNotaMinimaEtapa',
  ELIMINACAO_CORTE_EM_AREA: 'DocumentoDaConfiguracaoEliminacaoParametrosCorteEmArea',
  ELIMINACAO_ZERO_EM_AREA: 'DocumentoDaConfiguracaoComunsSemParametros',
  ELIMINACAO_FALTA_EM_DIA_DE_PROVA_ENEM: 'DocumentoDaConfiguracaoComunsSemParametros',
  ELIMINACAO_AUSENCIA_NA_ETAPA: 'DocumentoDaConfiguracaoEliminacaoParametrosAusenciaNaEtapa',
} as const satisfies Record<string, keyof Esquemas>;

export const PARAMETROS_DO_DESEMPATE = {
  DESEMPATE_MAIOR_NOTA_ETAPA: 'DocumentoDaConfiguracaoDesempateParametrosMaiorNotaEtapa',
  DESEMPATE_MAIOR_IDADE: 'DocumentoDaConfiguracaoComunsSemParametros',
  DESEMPATE_IDOSO: 'DocumentoDaConfiguracaoDesempateParametrosIdoso',
  DESEMPATE_CONDICAO_SOBRE_DADO: 'DocumentoDaConfiguracaoDesempateCondicaoDoDesempate',
  DESEMPATE_MAIOR_NOTA_AREA_ENEM: 'DocumentoDaConfiguracaoDesempateParametrosMaiorNotaAreaEnem',
} as const satisfies Record<string, keyof Esquemas>;

export type ParametrosDaEliminacao = {
  [C in keyof typeof PARAMETROS_DA_ELIMINACAO]: Esquemas[(typeof PARAMETROS_DA_ELIMINACAO)[C]];
};
export type ParametrosDoDesempate = {
  [C in keyof typeof PARAMETROS_DO_DESEMPATE]: Esquemas[(typeof PARAMETROS_DO_DESEMPATE)[C]];
};
