import { ModoDeDeliberacao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import {
  alterarRegra,
  normalizarRegra,
  pedeDesempate,
  pedeResultadoSemUnanimidade,
  quorumSegueOsIntegrantes,
  regraNova,
} from './regra-de-deliberacao';
import { ATO_INDIVIDUAL, COLEGIADA, comRegra } from './regra-de-deliberacao.testing';

describe('regraNova', () => {
  it('começa a colegiada sem nada escolhido e sem suplentes', () => {
    expect(regraNova(ModoDeDeliberacao.colegiadaComVotacao)).toEqual({
      modo: ModoDeDeliberacao.colegiadaComVotacao,
      integrantes: '',
      suplentes: '0',
      quorum: '',
      criterio: '',
      desempate: '',
      encerramento: '',
      semUnanimidade: '',
    });
  });

  it('começa o ato individual sem nenhum campo de votação', () => {
    expect(regraNova(ModoDeDeliberacao.atoIndividual)).toMatchObject({
      modo: ModoDeDeliberacao.atoIndividual,
      quorum: '',
      criterio: '',
      encerramento: '',
    });
  });
});

describe('normalizarRegra', () => {
  it('deixa vazio o que o ato individual não tem', () => {
    const regra = normalizarRegra(comRegra({ modo: ModoDeDeliberacao.atoIndividual }));

    expect(regra).toMatchObject({
      quorum: '',
      criterio: '',
      desempate: '',
      encerramento: '',
      semUnanimidade: '',
    });
  });

  it('iguala o quórum aos integrantes quando todos os titulares votam', () => {
    const regra = normalizarRegra(comRegra({ encerramento: 'todosOsTitulares', quorum: '2' }));

    expect(regra.quorum).toBe('5');
  });

  it('mantém o quórum digitado quando a presidência encerra ao atingi-lo', () => {
    expect(normalizarRegra(COLEGIADA).quorum).toBe('3');
  });

  it('tira o desempate da unanimidade e o resultado sem unanimidade da maioria', () => {
    const unanimidade = normalizarRegra(comRegra({ criterio: 'unanimidade' }));
    const maioria = normalizarRegra(comRegra({ semUnanimidade: 'favoravel' }));

    expect(unanimidade.desempate).toBe('');
    expect(maioria.semUnanimidade).toBe('');
  });

  it('tira desempate e resultado sem unanimidade quando só há um integrante', () => {
    const maioria = normalizarRegra(comRegra({ integrantes: '1' }));
    const unanimidade = normalizarRegra(
      comRegra({ integrantes: '1', criterio: 'unanimidade', semUnanimidade: 'desfavoravel' }),
    );

    expect(maioria.desempate).toBe('');
    expect(unanimidade.semUnanimidade).toBe('');
  });

  it('guarda o desempate enquanto o número de integrantes ainda não foi digitado', () => {
    expect(normalizarRegra(comRegra({ integrantes: '' })).desempate).toBe('votoDaPresidencia');
  });
});

describe('alterarRegra', () => {
  it('troca o critério e já descarta o desempate que ele não admite', () => {
    const regra = alterarRegra(COLEGIADA, 'criterio', 'unanimidade');

    expect(regra.criterio).toBe('unanimidade');
    expect(regra.desempate).toBe('');
  });

  it('troca o modo para o ato individual e limpa a votação', () => {
    const regra = alterarRegra(COLEGIADA, 'modo', ModoDeDeliberacao.atoIndividual);

    expect(regra).toMatchObject({ criterio: '', quorum: '', encerramento: '' });
  });

  it('acompanha o número de integrantes no quórum que não se digita', () => {
    const fixa = comRegra({ encerramento: 'todosOsTitulares', quorum: '5' });

    expect(alterarRegra(fixa, 'integrantes', '7').quorum).toBe('7');
  });
});

describe('o que a regra pede', () => {
  it('pede desempate só na maioria, colegiada e com mais de um integrante', () => {
    expect(pedeDesempate(COLEGIADA)).toBe(true);
    expect(pedeDesempate(comRegra({ criterio: 'unanimidade' }))).toBe(false);
    expect(pedeDesempate(comRegra({ integrantes: '1' }))).toBe(false);
    expect(pedeDesempate(ATO_INDIVIDUAL)).toBe(false);
  });

  it('pede o resultado sem unanimidade só na unanimidade com mais de um integrante', () => {
    expect(pedeResultadoSemUnanimidade(comRegra({ criterio: 'unanimidade' }))).toBe(true);
    expect(pedeResultadoSemUnanimidade(COLEGIADA)).toBe(false);
    expect(
      pedeResultadoSemUnanimidade(comRegra({ criterio: 'unanimidade', integrantes: '1' })),
    ).toBe(false);
  });

  it('fixa o quórum só quando todos os titulares votam', () => {
    expect(quorumSegueOsIntegrantes(comRegra({ encerramento: 'todosOsTitulares' }))).toBe(true);
    expect(quorumSegueOsIntegrantes(COLEGIADA)).toBe(false);
    expect(quorumSegueOsIntegrantes(ATO_INDIVIDUAL)).toBe(false);
  });
});
