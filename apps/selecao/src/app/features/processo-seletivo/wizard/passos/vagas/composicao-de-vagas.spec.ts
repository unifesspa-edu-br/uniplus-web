import { describe, expect, it } from 'vitest';

import { decodificarComposicaoVagas, ehRamoFederal } from './composicao-de-vagas';

describe('ehRamoFederal', () => {
  it('reconhece o ramo da Lei de Cotas que a regra declara', () => {
    expect(ehRamoFederal('LEI_DE_COTAS')).toBe(true);
  });

  it.each([['QUADRO_FIXADO_NO_EDITAL'], [''], [null], [undefined]])(
    'não reconhece %j como ramo federal',
    (ramo) => {
      expect(ehRamoFederal(ramo)).toBe(false);
    },
  );
});

describe('decodificarComposicaoVagas', () => {
  /** O catálogo de Configuração publica o token canônico. */
  it.each([
    ['RETIRADA_DE_OUTRA_MODALIDADE'],
    ['DENTRO_DA_RESERVA_LEGAL'],
    ['RESTANTE_DAS_VAGAS_OFERTADAS'],
    ['SUPLEMENTAR_AO_TOTAL'],
  ])('reconhece o token canônico %j', (token) => {
    expect(decodificarComposicaoVagas(token)).toBe(token);
  });

  /** O detalhe de Seleção emite o nome do membro do enum. */
  it.each([
    ['RetiradaDeOutraModalidade', 'RETIRADA_DE_OUTRA_MODALIDADE'],
    ['DentroDaReservaLegal', 'DENTRO_DA_RESERVA_LEGAL'],
    ['RestanteDasVagasOfertadas', 'RESTANTE_DAS_VAGAS_OFERTADAS'],
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
