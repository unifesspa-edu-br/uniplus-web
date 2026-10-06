import { describe, expect, it } from 'vitest';
import { comCodigoAparado, comRotuloExibivel, temCodigoUtilizavel, textoExibivel } from './com-rotulo-exibivel';

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

describe('código aparado', () => {
  it('comRotuloExibivel apara o código e usa o aparado como rótulo de reserva', () => {
    expect(comRotuloExibivel({ codigo: '  A ', rotulo: ' ' })).toEqual({ codigo: 'A', rotulo: 'A' });
  });

  it('comCodigoAparado apara o código e preserva o resto do item', () => {
    expect(comCodigoAparado({ codigo: ' A ', rotulo: 'Área' })).toEqual({ codigo: 'A', rotulo: 'Área' });
    expect(comCodigoAparado({ codigo: null, rotulo: 'Área' })).toEqual({ codigo: null, rotulo: 'Área' });
  });

  it.each([[undefined], [null], [''], ['   ']])('código %j não é utilizável', (codigo) => {
    expect(temCodigoUtilizavel({ codigo })).toBe(false);
  });

  it('textoExibivel usa o rótulo, depois o código, depois o traço', () => {
    expect(textoExibivel({ codigo: 'A', rotulo: 'Área' })).toBe('Área');
    expect(textoExibivel({ codigo: ' A ', rotulo: ' ' })).toBe('A');
    expect(textoExibivel({ codigo: '', rotulo: null })).toBe('—');
    expect(textoExibivel(null)).toBe('—');
  });
});
