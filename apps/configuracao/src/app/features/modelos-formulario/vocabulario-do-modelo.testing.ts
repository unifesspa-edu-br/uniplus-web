import {
  FinalidadeFormularioCodigo,
  FonteValoresFatoCodigo,
  OrigemFatoCodigo,
  QuantidadeDeValoresCodigo,
  TipoDoDadoCodigo,
} from '@uniplus/shared-data/configuracao';

export const FINALIDADE_INSCRICAO = {
  codigo: FinalidadeFormularioCodigo.INSCRICAO,
  rotulo: 'Inscrição',
};
export const FINALIDADE_ISENCAO = {
  codigo: FinalidadeFormularioCodigo.ISENCAO_TAXA,
  rotulo: 'Isenção',
};
export const DADO_SIM_OU_NAO = { codigo: TipoDoDadoCodigo.SIM_OU_NAO, rotulo: 'Sim ou não' };
export const DADO_OPCAO = { codigo: TipoDoDadoCodigo.OPCAO, rotulo: 'Opção' };
export const ORIGEM_DECLARADA = { codigo: OrigemFatoCodigo.DECLARADO, rotulo: 'Declarado' };
export const VALOR_UNICO = { codigo: QuantidadeDeValoresCodigo.VALOR_UNICO, rotulo: 'Um valor' };
export const FONTE_MUNICIPIOS = { codigo: FonteValoresFatoCodigo.MUNICIPIOS, rotulo: 'Municípios' };
