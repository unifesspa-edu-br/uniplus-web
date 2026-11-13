import type { RegraDeDeliberacaoDto } from '@uniplus/shared-data/selecao';
import { ModoDeDeliberacao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { regraComoInput, regraDoDto } from './regra-de-deliberacao-contrato';
import { ATO_INDIVIDUAL, COLEGIADA, comRegra } from './regra-de-deliberacao.testing';

const DTO_COLEGIADA: RegraDeDeliberacaoDto = {
  modo: ModoDeDeliberacao.colegiadaComVotacao,
  integrantes: 5,
  suplentes: 2,
  quorum: 3,
  criterio: 'maioriaSimples',
  desempate: 'votoDaPresidencia',
  encerramento: 'presidenciaNoQuorum',
  semUnanimidade: null,
};

describe('regraDoDto', () => {
  it('devolve a banca sem regra como nula, venha o campo nulo ou ausente', () => {
    expect(regraDoDto(null)).toBeNull();
    expect(regraDoDto(undefined)).toBeNull();
  });

  it('traz os números como o campo os edita e o que não há como vazio', () => {
    expect(regraDoDto(DTO_COLEGIADA)).toEqual(COLEGIADA);
  });

  it('lê o ato individual sem nenhum campo de votação', () => {
    const dto: RegraDeDeliberacaoDto = {
      modo: ModoDeDeliberacao.atoIndividual,
      integrantes: 1,
      suplentes: 0,
      quorum: null,
      criterio: null,
      desempate: null,
      encerramento: null,
      semUnanimidade: null,
    };

    expect(regraDoDto(dto)).toEqual(ATO_INDIVIDUAL);
  });
});

describe('regraComoInput', () => {
  it('leva a banca sem regra como nula', () => {
    expect(regraComoInput(null)).toBeNull();
  });

  it('leva a colegiada com os números e a votação declarada', () => {
    expect(regraComoInput(COLEGIADA)).toEqual(DTO_COLEGIADA);
  });

  it('leva o ato individual só com o modo e a composição', () => {
    expect(regraComoInput(ATO_INDIVIDUAL)).toEqual({
      modo: ModoDeDeliberacao.atoIndividual,
      integrantes: 1,
      suplentes: 0,
    });
  });

  it('leva o que não foi preenchido como nulo, para o servidor recusar pelo campo', () => {
    const input = regraComoInput(comRegra({ criterio: '', desempate: '', quorum: '' }));

    expect(input).toMatchObject({ quorum: null, criterio: null, desempate: null });
  });

  it('devolve à API o que dela recebeu', () => {
    expect(regraComoInput(regraDoDto(DTO_COLEGIADA))).toEqual(DTO_COLEGIADA);
  });
});
