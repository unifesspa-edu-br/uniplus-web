import {
  ConsequenciaDoDescumprimentoCodigo,
  FonteValoresFatoCodigo,
  OrigemFatoCodigo,
  QuantidadeDeValoresCodigo,
  TipoDoDadoCodigo,
} from '@uniplus/shared-data/configuracao';

export const DECLARACAO_DE_INSCRICAO = { serveAFaseDeInscricao: true, obrigatorio: true };
export const DECLARACAO_FORA_DA_INSCRICAO = { serveAFaseDeInscricao: false, obrigatorio: false };

export const CONSEQUENCIAS_DO_DESCUMPRIMENTO = [
  {
    codigo: ConsequenciaDoDescumprimentoCodigo.ELIMINA_DO_PROCESSO,
    rotulo: 'Eliminação do processo',
  },
  {
    codigo: ConsequenciaDoDescumprimentoCodigo.RETIRA_A_MODALIDADE,
    rotulo: 'Retirada da modalidade',
  },
  {
    codigo: ConsequenciaDoDescumprimentoCodigo.RETIRA_O_ACRESCIMO,
    rotulo: 'Retirada do acréscimo',
  },
];

export const DADO_SIM_OU_NAO = { codigo: TipoDoDadoCodigo.SIM_OU_NAO, rotulo: 'Sim ou não' };
export const DADO_OPCAO = { codigo: TipoDoDadoCodigo.OPCAO, rotulo: 'Opção' };
export const ORIGEM_DECLARADA = { codigo: OrigemFatoCodigo.DECLARADO, rotulo: 'Declarado' };
export const VALOR_UNICO = { codigo: QuantidadeDeValoresCodigo.VALOR_UNICO, rotulo: 'Um valor' };
export const FONTE_MUNICIPIOS = { codigo: FonteValoresFatoCodigo.MUNICIPIOS, rotulo: 'Municípios' };
