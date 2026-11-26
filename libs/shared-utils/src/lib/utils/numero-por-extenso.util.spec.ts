import { cardinalPorExtenso, ordinalPorExtenso } from './numero-por-extenso.util';

const casosCardinais: [number, string][] = [
  [0, 'zero'],
  [1, 'um'],
  [10, 'dez'],
  [11, 'onze'],
  [20, 'vinte'],
  [21, 'vinte e um'],
  [30, 'trinta'],
  [40, 'quarenta'],
  [50, 'cinquenta'],
  [60, 'sessenta'],
  [70, 'setenta'],
  [80, 'oitenta'],
  [90, 'noventa'],
  [100, 'cem'],
  [101, 'cento e um'],
  [115, 'cento e quinze'],
  [200, 'duzentos'],
  [300, 'trezentos'],
  [400, 'quatrocentos'],
  [500, 'quinhentos'],
  [600, 'seiscentos'],
  [700, 'setecentos'],
  [800, 'oitocentos'],
  [900, 'novecentos'],
  [999, 'novecentos e noventa e nove'],
];

const casosOrdinaisMasculinos: [number, string][] = [
  [1, 'primeiro'],
  [10, 'décimo'],
  [20, 'vigésimo'],
  [21, 'vigésimo primeiro'],
  [30, 'trigésimo'],
  [40, 'quadragésimo'],
  [50, 'quinquagésimo'],
  [60, 'sexagésimo'],
  [70, 'septuagésimo'],
  [80, 'octogésimo'],
  [90, 'nonagésimo'],
  [100, 'centésimo'],
  [200, 'ducentésimo'],
  [300, 'tricentésimo'],
  [400, 'quadringentésimo'],
  [500, 'quingentésimo'],
  [600, 'seiscentésimo'],
  [700, 'septingentésimo'],
  [800, 'octingentésimo'],
  [900, 'nongentésimo'],
  [999, 'nongentésimo nonagésimo nono'],
];

describe('número por extenso', () => {
  it.each(casosCardinais)('escreve o cardinal %i', (numero, esperado) => {
    expect(cardinalPorExtenso(numero)).toBe(esperado);
  });

  it.each(casosOrdinaisMasculinos)('escreve o ordinal masculino %i', (numero, esperado) => {
    expect(ordinalPorExtenso(numero, 'MASCULINO')).toBe(esperado);
  });

  it.each([
    [1, 'primeira'],
    [21, 'vigésima primeira'],
    [112, 'centésima décima segunda'],
    [600, 'seiscentésima'],
    [900, 'nongentésima'],
  ])('concorda o ordinal feminino %i', (numero, esperado) => {
    expect(ordinalPorExtenso(numero, 'FEMININO')).toBe(esperado);
  });
});
