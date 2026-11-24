import {
  FonteValoresFatoCodigo,
  OrigemFatoCodigo,
  QuantidadeDeValoresCodigo,
  TipoDoDadoCodigo,
} from '@uniplus/shared-data/configuracao';
export const DADO_SIM_OU_NAO = { codigo: TipoDoDadoCodigo.SIM_OU_NAO, rotulo: 'Sim ou não' };
export const DADO_OPCAO = { codigo: TipoDoDadoCodigo.OPCAO, rotulo: 'Opção' };
export const DADO_NUMERICO = { codigo: TipoDoDadoCodigo.NUMERICO, rotulo: 'Numérico' };
export const ORIGEM_DECLARADA = { codigo: OrigemFatoCodigo.DECLARADO, rotulo: 'Declarado' };
export const ORIGEM_CALCULADA = { codigo: OrigemFatoCodigo.CALCULADO, rotulo: 'Calculado' };
export const VALOR_UNICO = { codigo: QuantidadeDeValoresCodigo.VALOR_UNICO, rotulo: 'Valor único' };
export const VARIOS_VALORES = {
  codigo: QuantidadeDeValoresCodigo.VARIOS_VALORES,
  rotulo: 'Vários valores',
};
export const VALORES_MODALIDADE = {
  codigo: FonteValoresFatoCodigo.MODALIDADE,
  rotulo: 'Modalidade',
};
