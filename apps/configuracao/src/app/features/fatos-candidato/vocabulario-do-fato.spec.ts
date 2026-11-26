import { describe, expect, it } from 'vitest';
import { comOpcaoAtual } from './vocabulario-do-fato';

const quilo = { codigo: 'QUILO', rotulo: 'Quilo' };
const grama = { codigo: 'GRAMA', rotulo: 'Grama' };

describe('comOpcaoAtual', () => {
  it('mantém visível o valor gravado quando a lista não chegou', () => {
    expect(comOpcaoAtual([], quilo)).toEqual([quilo]);
  });

  it('põe o valor gravado à frente quando a lista não o traz', () => {
    expect(comOpcaoAtual([grama], quilo)).toEqual([quilo, grama]);
  });

  it('não repete o valor gravado que a lista já traz', () => {
    expect(comOpcaoAtual([grama, quilo], quilo)).toEqual([grama, quilo]);
  });

  it('devolve a lista como veio quando não há valor gravado', () => {
    expect(comOpcaoAtual([grama], null)).toEqual([grama]);
    expect(comOpcaoAtual([grama], undefined)).toEqual([grama]);
  });
});
