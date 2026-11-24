import type { components } from './schema';

type Esquemas = components['schemas'];

export const PARAMETROS_DA_ELIMINACAO = {
  'ELIMINACAO-NOTA-MINIMA-ETAPA': 'DocumentoDaConfiguracaoEliminacaoParametrosNotaMinimaEtapa',
  'ELIMINACAO-CORTE-EM-AREA': 'DocumentoDaConfiguracaoEliminacaoParametrosCorteEmArea',
  'ELIMINACAO-ZERO-EM-AREA': 'DocumentoDaConfiguracaoComunsSemParametros',
  'ELIMINACAO-FALTA-EM-DIA-DE-PROVA-ENEM': 'DocumentoDaConfiguracaoComunsSemParametros',
  'ELIMINACAO-AUSENCIA-NA-ETAPA': 'DocumentoDaConfiguracaoEliminacaoParametrosAusenciaNaEtapa',
} as const satisfies Record<string, keyof Esquemas>;

export const PARAMETROS_DO_DESEMPATE = {
  'DESEMPATE-MAIOR-NOTA-ETAPA': 'DocumentoDaConfiguracaoDesempateParametrosMaiorNotaEtapa',
  'DESEMPATE-MAIOR-IDADE': 'DocumentoDaConfiguracaoComunsSemParametros',
  'DESEMPATE-IDOSO': 'DocumentoDaConfiguracaoDesempateParametrosIdoso',
  'DESEMPATE-CONDICAO-SOBRE-DADO': 'DocumentoDaConfiguracaoDesempateCondicaoDoDesempate',
  'DESEMPATE-MAIOR-NOTA-AREA-ENEM': 'DocumentoDaConfiguracaoDesempateParametrosMaiorNotaAreaEnem',
} as const satisfies Record<string, keyof Esquemas>;

export type ParametrosDaEliminacao = {
  [C in keyof typeof PARAMETROS_DA_ELIMINACAO]: Esquemas[(typeof PARAMETROS_DA_ELIMINACAO)[C]];
};
export type ParametrosDoDesempate = {
  [C in keyof typeof PARAMETROS_DO_DESEMPATE]: Esquemas[(typeof PARAMETROS_DO_DESEMPATE)[C]];
};
