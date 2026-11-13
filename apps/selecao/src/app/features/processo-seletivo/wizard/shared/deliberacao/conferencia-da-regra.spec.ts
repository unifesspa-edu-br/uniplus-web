import { describe, expect, it } from 'vitest';

import { problemasDaRegra, problemasDaRegraPorCampo } from './conferencia-da-regra';
import { ATO_INDIVIDUAL, COLEGIADA, comRegra } from './regra-de-deliberacao.testing';

const campos = (regra: Parameters<typeof problemasDaRegra>[0]) =>
  problemasDaRegra(regra).map((problema) => problema.campo);

describe('problemasDaRegra', () => {
  it('aceita a colegiada completa e o ato individual de um titular', () => {
    expect(problemasDaRegra(COLEGIADA)).toEqual([]);
    expect(problemasDaRegra(ATO_INDIVIDUAL)).toEqual([]);
  });

  it('cobra os integrantes quando faltam, são zero ou não são inteiros', () => {
    expect(campos(comRegra({ integrantes: '' }))).toContain('integrantes');
    expect(campos(comRegra({ integrantes: '0' }))).toContain('integrantes');
    expect(campos(comRegra({ integrantes: '2,5' }))).toContain('integrantes');
  });

  it('cobra os suplentes em branco e aceita zero', () => {
    expect(campos(comRegra({ suplentes: '' }))).toEqual(['suplentes']);
    expect(campos(comRegra({ suplentes: '0' }))).toEqual([]);
  });

  it('cobra critério e encerramento da colegiada, e não do ato individual', () => {
    expect(campos(comRegra({ criterio: '', encerramento: '' }))).toEqual([
      'criterio',
      'encerramento',
    ]);
    expect(campos(comRegra({ criterio: '', encerramento: '' }, ATO_INDIVIDUAL))).toEqual([]);
  });

  it('cobra o quórum fora do intervalo de um até os integrantes', () => {
    expect(campos(comRegra({ quorum: '' }))).toEqual(['quorum']);
    expect(campos(comRegra({ quorum: '0' }))).toEqual(['quorum']);
    expect(campos(comRegra({ quorum: '6' }))).toEqual(['quorum']);
    expect(campos(comRegra({ quorum: '5' }))).toEqual([]);
  });

  it('não cobra o quórum que acompanha os integrantes', () => {
    expect(campos(comRegra({ encerramento: 'todosOsTitulares', quorum: '' }))).toEqual([]);
  });

  it('cobra o desempate da maioria que pode empatar', () => {
    expect(campos(comRegra({ desempate: '' }))).toEqual(['desempate']);
    expect(campos(comRegra({ desempate: '', integrantes: '1', quorum: '1' }))).toEqual([]);
  });

  it('cobra o resultado sem unanimidade da unanimidade com mais de um integrante', () => {
    const unanimidade = comRegra({ criterio: 'unanimidade', desempate: '' });

    expect(campos(unanimidade)).toEqual(['semUnanimidade']);
    expect(campos({ ...unanimidade, semUnanimidade: 'novaVotacao' })).toEqual([]);
  });

  it('diz o que fazer em cada campo cobrado', () => {
    const [problema] = problemasDaRegra(comRegra({ criterio: '' }));

    expect(problema.mensagem).toContain('critério');
  });
});

describe('problemasDaRegraPorCampo', () => {
  it('reúne a mensagem de cada campo cobrado', () => {
    const porCampo = problemasDaRegraPorCampo(comRegra({ criterio: '', suplentes: '' }));

    expect([...porCampo.keys()]).toEqual(['suplentes', 'criterio']);
  });

  it('não acusa nada da banca sem regra', () => {
    expect(problemasDaRegraPorCampo(null).size).toBe(0);
  });
});
