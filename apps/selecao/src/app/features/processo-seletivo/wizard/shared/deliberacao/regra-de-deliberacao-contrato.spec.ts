import type { RegraDeDeliberacaoDto } from '@uniplus/shared-data/selecao';
import { ModoDeDeliberacao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { regraComoInput, regraDoDto } from './regra-de-deliberacao-contrato';
import { ATO_INDIVIDUAL, COLEGIADA, comRegra } from './regra-de-deliberacao.testing';

const DTO_COLEGIADA: RegraDeDeliberacaoDto = {
  modo: { codigo: ModoDeDeliberacao.colegiadaComVotacao, rotulo: 'Colegiada' },
  integrantes: 5,
  suplentes: 2,
  quorum: 3,
  criterio: {
    codigo: 'maioriaSimples' as NonNullable<RegraDeDeliberacaoDto['criterio']>['codigo'],
    rotulo: 'teste',
  },
  desempate: {
    codigo: 'votoDaPresidencia' as NonNullable<RegraDeDeliberacaoDto['desempate']>['codigo'],
    rotulo: 'teste',
  },
  encerramento: {
    codigo: 'presidenciaNoQuorum' as NonNullable<RegraDeDeliberacaoDto['encerramento']>['codigo'],
    rotulo: 'teste',
  },
  semUnanimidade: null,
};

describe('regraDoDto', () => {
  it('devolve a banca sem regra como nula, venha o campo nulo ou ausente', () => {
    expect(regraDoDto(null)).toBeNull();
    expect(regraDoDto(undefined)).toBeNull();
  });

  it('traz os números como o campo os edita e o que não há como vazio', () => {
    expect(regraDoDto(DTO_COLEGIADA)).toEqual({
      ...COLEGIADA,
      rotulos: {
        modo: DTO_COLEGIADA.modo,
        criterio: DTO_COLEGIADA.criterio,
        desempate: DTO_COLEGIADA.desempate,
        encerramento: DTO_COLEGIADA.encerramento,
      },
    });
  });

  it('lê o ato individual sem nenhum campo de votação', () => {
    const dto: RegraDeDeliberacaoDto = {
      modo: { codigo: ModoDeDeliberacao.atoIndividual, rotulo: 'Individual' },
      integrantes: 1,
      suplentes: 0,
      quorum: null,
      criterio: null,
      desempate: null,
      encerramento: null,
      semUnanimidade: null,
    };

    expect(regraDoDto(dto)).toEqual({ ...ATO_INDIVIDUAL, rotulos: { modo: dto.modo } });
  });
});

const INPUT_COLEGIADA = {
  modo: ModoDeDeliberacao.colegiadaComVotacao,
  integrantes: 5,
  suplentes: 2,
  quorum: 3,
  criterio: 'maioriaSimples',
  desempate: 'votoDaPresidencia',
  encerramento: 'presidenciaNoQuorum',
  semUnanimidade: null,
};

describe('regraComoInput', () => {
  it('leva a banca sem regra como nula', () => {
    expect(regraComoInput(null)).toBeNull();
  });

  it('leva a colegiada com os números e a votação declarada', () => {
    expect(regraComoInput(COLEGIADA)).toEqual(INPUT_COLEGIADA);
  });

  it('leva o ato individual sem votação com os campos nulos', () => {
    expect(regraComoInput(ATO_INDIVIDUAL)).toEqual({
      modo: ModoDeDeliberacao.atoIndividual,
      integrantes: 1,
      suplentes: 0,
      quorum: null,
      criterio: null,
      desempate: null,
      encerramento: null,
      semUnanimidade: null,
    });
  });

  it('envia a votação do recurso no ato individual', () => {
    const regra = comRegra({ modo: ModoDeDeliberacao.atoIndividual });

    expect(regraComoInput(regra)).toEqual({
      ...INPUT_COLEGIADA,
      modo: ModoDeDeliberacao.atoIndividual,
    });
  });

  it('leva o que não foi preenchido como nulo, para o servidor recusar pelo campo', () => {
    const input = regraComoInput(comRegra({ criterio: '', desempate: '', quorum: '' }));

    expect(input).toMatchObject({ quorum: null, criterio: null, desempate: null });
  });

  it('devolve à API o que dela recebeu', () => {
    expect(regraComoInput(regraDoDto(DTO_COLEGIADA))).toEqual(INPUT_COLEGIADA);
  });
});
