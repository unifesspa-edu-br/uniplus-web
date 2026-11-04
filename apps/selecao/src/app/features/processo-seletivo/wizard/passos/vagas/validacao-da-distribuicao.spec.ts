import { describe, expect, it } from 'vitest';

import {
  INSTITUCIONAL,
  CATALOGO,
  par,
  mensagens,
  distribuicao,
} from './distribuicao-de-vagas.testing';
import { ofertasRepetidas, problemasDaDistribuicao } from './validacao-da-distribuicao';

describe('problemasDaDistribuicao — forma básica (UNI-REQ-0134)', () => {
  it('aceita uma distribuição institucional completa', () => {
    expect(problemasDaDistribuicao(distribuicao(), CATALOGO)).toEqual([]);
  });

  it.each([['0'], ['-5'], [''], ['dez'], ['1e2'], ['0x10']])(
    'recusa total de vagas %j',
    (voBase) => {
      const problemas = problemasDaDistribuicao(distribuicao({ voBase }), CATALOGO);
      expect(mensagens(problemas).some((p) => p.includes('total de vagas'))).toBe(true);
    },
  );

  /** Art. 10, II: piso legal de 50% e teto de 100%. */
  it.each([['0,4'], ['0,49'], ['1,01'], ['2']])('recusa PR %j fora do intervalo legal', (pr) => {
    const problemas = problemasDaDistribuicao(distribuicao({ pr }), CATALOGO);
    expect(mensagens(problemas).some((p) => p.includes('entre 0,5 e 1,0'))).toBe(true);
  });

  it.each([['0,5'], ['0,75'], ['1'], ['1,0']])('aceita PR %j', (pr) => {
    expect(problemasDaDistribuicao(distribuicao({ pr }), CATALOGO)).toEqual([]);
  });

  it('recusa PR com mais de quatro casas decimais', () => {
    const problemas = problemasDaDistribuicao(distribuicao({ pr: '0,50001' }), CATALOGO);
    expect(
      mensagens(problemas).some((p) => p.includes('quatro casas') || p.includes('4 casas')),
    ).toBe(true);
  });

  it('recusa oferta sem modalidade', () => {
    const problemas = problemasDaDistribuicao(
      distribuicao({ modalidades: [], quadro: [] }),
      CATALOGO,
    );
    expect(mensagens(problemas).some((p) => p.includes('ao menos uma modalidade'))).toBe(true);
  });

  it('recusa a mesma modalidade duas vezes na oferta', () => {
    const problemas = problemasDaDistribuicao(
      distribuicao({ modalidades: [par(INSTITUCIONAL), par(INSTITUCIONAL)] }),
      CATALOGO,
    );
    expect(mensagens(problemas).some((p) => p.includes('uma vez nesta oferta'))).toBe(true);
  });
});

describe('ofertasRepetidas', () => {
  /** UNI-REQ-0134: cada oferta participa de no máximo uma distribuição. */
  it('aponta a oferta usada duas vezes', () => {
    const repetidas = ofertasRepetidas([
      distribuicao({ ofertaCursoId: 'oferta-1' }),
      distribuicao({ ofertaCursoId: 'oferta-2' }),
      distribuicao({ ofertaCursoId: 'oferta-1' }),
    ]);

    expect(repetidas).toEqual(['oferta-1']);
  });

  it('não aponta nada quando cada oferta aparece uma vez', () => {
    expect(
      ofertasRepetidas([
        distribuicao({ ofertaCursoId: 'oferta-1' }),
        distribuicao({ ofertaCursoId: 'oferta-2' }),
      ]),
    ).toEqual([]);
  });
});
