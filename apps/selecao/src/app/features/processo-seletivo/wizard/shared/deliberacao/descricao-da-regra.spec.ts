import { describe, expect, it } from 'vitest';

import { descricaoDaRegra, SEM_REGRA_DE_DELIBERACAO } from './descricao-da-regra';
import { ATO_INDIVIDUAL, COLEGIADA, comRegra } from './regra-de-deliberacao.testing';

describe('descricaoDaRegra', () => {
  it('diz que a banca não declarou regra', () => {
    expect(descricaoDaRegra(null)).toBe(SEM_REGRA_DE_DELIBERACAO);
  });

  it('descreve a colegiada em uma linha, com quórum, critério, encerramento e desempate', () => {
    expect(descricaoDaRegra(COLEGIADA)).toBe(
      '5 titulares, 2 suplentes; quórum 3; maioria simples; ' +
        'encerra: a presidência encerra ao atingir o quórum; desempate: voto da presidência',
    );
  });

  it('descreve a unanimidade com o resultado sem unanimidade e sem suplentes', () => {
    const regra = comRegra({
      criterio: 'unanimidade',
      desempate: '',
      semUnanimidade: 'novaVotacao',
      suplentes: '0',
    });

    expect(descricaoDaRegra(regra)).toBe(
      '5 titulares, sem suplentes; quórum 3; unanimidade; ' +
        'encerra: a presidência encerra ao atingir o quórum; sem unanimidade: nova votação',
    );
  });

  it('descreve o ato individual sem quórum nem votação', () => {
    expect(descricaoDaRegra(ATO_INDIVIDUAL)).toBe('1 titulares, sem suplentes; ato individual');
  });
});
