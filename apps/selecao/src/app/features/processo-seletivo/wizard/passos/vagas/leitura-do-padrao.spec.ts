import { describe, expect, it } from 'vitest';

import { leituraDoPadrao, type EntradaDaLeituraDoPadrao } from './leitura-do-padrao';
import { PadraoDoEdital } from './padrao-do-edital';

const PADRAO: PadraoDoEdital = {
  regraDistribuicaoCodigo: 'DISTRIB-VAGAS-INSTITUCIONAL',
  regraDistribuicaoVersao: '1.0',
  ramoDaDistribuicao: null,
  regraAjusteCodigo: null,
  regraAjusteVersao: null,
  referenciaReservaDemograficaId: null,
  modalidades: [],
  pr: '',
};

function modalidadesLidas(
  nome: string,
  catalogoLido: boolean,
  motivoDaAusencia = 'não foi lido',
): readonly string[] {
  const entrada: EntradaDaLeituraDoPadrao = {
    padrao: PADRAO,
    modalidades: [{ codigo: 'ZZ_TESTE', nome }],
    referencias: [],
    catalogoLido,
    motivoDaAusencia,
  };
  return leituraDoPadrao(entrada).modalidades;
}

describe('leituraDoPadrao — modalidades', () => {
  it('mostra o código e o nome', () => {
    expect(modalidadesLidas('Modalidade de teste Alfa', true)).toEqual([
      'ZZ_TESTE — Modalidade de teste Alfa',
    ]);
  });

  it('mostra só o código quando o catálogo foi lido e a modalidade não tem nome', () => {
    expect(modalidadesLidas('', true)).toEqual(['ZZ_TESTE']);
  });

  it('diz por que falta o nome quando o catálogo não foi lido', () => {
    expect(modalidadesLidas('', false, 'ainda carrega')).toEqual([
      'ZZ_TESTE — nome: o catálogo ainda carrega',
    ]);
  });
});
