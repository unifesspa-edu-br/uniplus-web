import { TipoLocalOfertaCodigo } from '@uniplus/shared-data/configuracao';

export const TIPO_LOCAL_DE_TESTE = {
  codigo: TipoLocalOfertaCodigo.POLO_DE_EDUCACAO_A_DISTANCIA,
  rotulo: 'Polo de teste',
};

export const OUTRO_TIPO_LOCAL_DE_TESTE = {
  codigo: TipoLocalOfertaCodigo.CAMPUS_FORA_DE_SEDE,
  rotulo: 'Outro local de teste',
};

export const TIPOS_LOCAIS_DE_TESTE = [TIPO_LOCAL_DE_TESTE, OUTRO_TIPO_LOCAL_DE_TESTE];
