import { describe, expect, it } from 'vitest';

import { AC, AC_PCD, INSTITUCIONAL, par, distribuicao } from './distribuicao-de-vagas.testing';
import { seguemOMesmoPadrao } from './padrao-do-edital';

describe('seguemOMesmoPadrao', () => {
  const PADRAO = {
    regraDistribuicaoCodigo: 'DISTRIB-VAGAS-INSTITUCIONAL',
    regraDistribuicaoVersao: '1.0',
    regraAjusteCodigo: null,
    regraAjusteVersao: null,
    referenciaReservaDemograficaId: null,
    modalidades: [par(AC), par(AC_PCD)],
    pr: '0,5',
  };

  it('aceita a oferta que repete o padrão', () => {
    expect(seguemOMesmoPadrao(distribuicao({ modalidades: PADRAO.modalidades }), PADRAO)).toBe(
      true,
    );
  });

  /** A ordem é de gravação, não de significado. */
  it('ignora a ordem das modalidades', () => {
    const invertida = distribuicao({ modalidades: [par(AC_PCD), par(AC)] });

    expect(seguemOMesmoPadrao(invertida, PADRAO)).toBe(true);
  });

  it.each([
    ['a regra', { regraDistribuicaoCodigo: 'DISTRIB-VAGAS-LEI-12711' }],
    ['a versão da regra', { regraDistribuicaoVersao: '2.0' }],
    ['o ajuste', { regraAjusteCodigo: 'AJUSTE-ART-11' }],
    ['a referência demográfica', { referenciaReservaDemograficaId: 'ref-1' }],
    ['o percentual', { pr: '0,75' }],
  ])('recusa quando %s difere', (_caso, diferenca) => {
    const oferta = distribuicao({ modalidades: PADRAO.modalidades, ...diferenca });

    expect(seguemOMesmoPadrao(oferta, PADRAO)).toBe(false);
  });

  it.each([
    ['a mais', [par(AC), par(AC_PCD), par(INSTITUCIONAL)]],
    ['a menos', [par(AC)]],
    ['trocada', [par(AC), par(INSTITUCIONAL)]],
  ])('recusa com modalidade %s', (_caso, modalidades) => {
    expect(seguemOMesmoPadrao(distribuicao({ modalidades }), PADRAO)).toBe(false);
  });
});
