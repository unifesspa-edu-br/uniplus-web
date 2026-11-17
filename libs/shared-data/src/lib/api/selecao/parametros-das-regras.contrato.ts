import type { components } from './schema';

type Esquemas = components['schemas'];

export const PARAMETROS_DA_ELIMINACAO = {
  'ELIM-NOTA-MINIMA-ETAPA': 'DocumentoDaConfiguracaoEliminacaoParametrosNotaMinimaEtapa',
  'ELIM-CORTE-EM-AREA': 'DocumentoDaConfiguracaoEliminacaoParametrosCorteEmArea',
  'ELIM-ZERO-EM-AREA': 'DocumentoDaConfiguracaoComunsSemParametros',
  'ELIM-FALTA-EM-DIA-DE-PROVA-ENEM': 'DocumentoDaConfiguracaoComunsSemParametros',
  'ELIM-AUSENCIA-NA-ETAPA': 'DocumentoDaConfiguracaoEliminacaoParametrosAusenciaNaEtapa',
} as const satisfies Record<string, keyof Esquemas>;

export const PARAMETROS_DO_DESEMPATE = {
  'DESEMPATE-MAIOR-NOTA-ETAPA': 'DocumentoDaConfiguracaoDesempateParametrosMaiorNotaEtapa',
  'DESEMPATE-MAIOR-IDADE': 'DocumentoDaConfiguracaoComunsSemParametros',
  'DESEMPATE-IDOSO': 'DocumentoDaConfiguracaoDesempateParametrosIdoso',
  'DESEMPATE-PREDICADO-FATO': 'DocumentoDaConfiguracaoDesempateCondicaoDoDesempate',
  'DESEMPATE-MAIOR-NOTA-AREA-ENEM': 'DocumentoDaConfiguracaoDesempateParametrosMaiorNotaAreaEnem',
} as const satisfies Record<string, keyof Esquemas>;

export type ParametrosDaEliminacao = {
  [C in keyof typeof PARAMETROS_DA_ELIMINACAO]: Esquemas[(typeof PARAMETROS_DA_ELIMINACAO)[C]];
};
export type ParametrosDoDesempate = {
  [C in keyof typeof PARAMETROS_DO_DESEMPATE]: Esquemas[(typeof PARAMETROS_DO_DESEMPATE)[C]];
};
