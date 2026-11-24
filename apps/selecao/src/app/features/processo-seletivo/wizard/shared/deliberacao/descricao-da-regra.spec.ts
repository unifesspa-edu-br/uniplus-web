import {
  CriterioDeVotacaoCodigo,
  ResultadoSemUnanimidadeCodigo,
  ModoDeDeliberacao,
} from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { descricaoDaRegra, SEM_REGRA_DE_DELIBERACAO } from './descricao-da-regra';
import { ATO_INDIVIDUAL, COLEGIADA, comRegra } from './regra-de-deliberacao.testing';
import { comRotulos } from './vocabularios-da-regra.testing';

describe('descricaoDaRegra', () => {
  it('diz que a banca não declarou regra', () => {
    expect(descricaoDaRegra(null)).toBe(SEM_REGRA_DE_DELIBERACAO);
  });

  it('descreve a colegiada em uma linha, com quórum, critério, encerramento e desempate', () => {
    expect(descricaoDaRegra(comRotulos(COLEGIADA))).toBe(
      '5 titulares, 2 suplentes; Colegiada, com votação; quórum 3; Maioria simples; ' +
        'encerra: A presidência encerra ao atingir o quórum; desempate: Voto da presidência',
    );
  });

  it('descreve a unanimidade com o resultado sem unanimidade e sem suplentes', () => {
    const regra = comRegra({
      criterio: CriterioDeVotacaoCodigo.UNANIMIDADE,
      desempate: '',
      semUnanimidade: ResultadoSemUnanimidadeCodigo.NOVA_VOTACAO,
      suplentes: '0',
    });

    expect(descricaoDaRegra(comRotulos(regra))).toBe(
      '5 titulares, sem suplentes; Colegiada, com votação; quórum 3; Unanimidade; ' +
        'encerra: A presidência encerra ao atingir o quórum; sem unanimidade: Nova votação',
    );
  });

  it('descreve o ato individual sem quórum nem votação', () => {
    expect(descricaoDaRegra(comRotulos(ATO_INDIVIDUAL))).toBe(
      '1 titular, sem suplentes; Ato individual',
    );
  });

  it('descreve a votação do recurso no ato individual', () => {
    const regra = comRegra({ modo: ModoDeDeliberacao.ATO_INDIVIDUAL });

    expect(descricaoDaRegra(comRotulos(regra))).toBe(
      '5 titulares, 2 suplentes; Ato individual; recurso: quórum 3; Maioria simples; encerra: A presidência encerra ao atingir o quórum; desempate: Voto da presidência',
    );
  });

  it('descreve no singular o titular e o suplente únicos', () => {
    expect(descricaoDaRegra(comRegra({ integrantes: '1', suplentes: '1', quorum: '1' }))).toContain(
      '1 titular, 1 suplente;',
    );
  });
});
