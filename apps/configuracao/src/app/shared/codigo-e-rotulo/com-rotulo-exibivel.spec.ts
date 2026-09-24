import { describe, expect, it } from 'vitest';
import { comRotuloExibivel } from './com-rotulo-exibivel';

describe('comRotuloExibivel', () => {
  it('mantém o rótulo quando ele existe', () => {
    expect(comRotuloExibivel({ codigo: 'A', rotulo: 'Área A' }).rotulo).toBe('Área A');
  });

  it.each([[''], ['   '], [null], [undefined]])('rótulo %j cai no código', (rotulo) => {
    expect(comRotuloExibivel({ codigo: 'A', rotulo }).rotulo).toBe('A');
  });

  it('sem rótulo nem código, o rótulo fica vazio', () => {
    expect(comRotuloExibivel({ codigo: null, rotulo: null })).toEqual({ codigo: '', rotulo: '' });
  });
});
