import { describe, expect, it } from 'vitest';

import { REGRA_LEI_12711, REGRA_LEI_12711_COM_AC_PCD } from './distribuicao-de-vagas.testing';
import { decodificarComposicaoVagas, ehRamoFederal } from './composicao-de-vagas';

describe('ehRamoFederal', () => {
  it.each([[REGRA_LEI_12711], [REGRA_LEI_12711_COM_AC_PCD]])(
    'reconhece %j como ramo federal',
    (codigo) => {
      expect(ehRamoFederal(codigo)).toBe(true);
    },
  );

  it.each([
    ['DISTRIB-VAGAS-INSTITUCIONAL'],
    ['DISTRIB-VAGAS-PSIQ'],
    ['DISTRIB-VAGAS-COM-PCD-PURO'],
  ])('não reconhece %j como ramo federal', (codigo) => {
    expect(ehRamoFederal(codigo)).toBe(false);
  });
});

describe('decodificarComposicaoVagas', () => {
  /** O catálogo de Configuração publica o token canônico. */
  it.each([['RETIRA_DE'], ['DENTRO_DO_VR'], ['RESIDUAL_DO_VO'], ['SUPLEMENTAR_AO_TOTAL']])(
    'reconhece o token canônico %j',
    (token) => {
      expect(decodificarComposicaoVagas(token)).toBe(token);
    },
  );

  /** O detalhe de Seleção emite o nome do membro do enum. */
  it.each([
    ['RetiraDe', 'RETIRA_DE'],
    ['DentroDoVr', 'DENTRO_DO_VR'],
    ['ResidualDoVo', 'RESIDUAL_DO_VO'],
    ['SuplementarAoTotal', 'SUPLEMENTAR_AO_TOTAL'],
  ])('traduz %j do detalhe para %j', (wire, canonico) => {
    expect(decodificarComposicaoVagas(wire)).toBe(canonico);
  });

  /** Grafia desconhecida é ausência de informação, não composição a inventar. */
  it.each([[''], ['COMPOSICAO_NOVA'], ['RETIRA'], ['retira_de_algo']])(
    'recusa %j',
    (desconhecida) => {
      expect(decodificarComposicaoVagas(desconhecida)).toBeNull();
    },
  );
});
