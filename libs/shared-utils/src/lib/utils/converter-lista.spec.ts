import { describe, expect, it } from 'vitest';
import { converterLista } from './converter-lista';

describe('converterLista', () => {
  it('converte cada item, na ordem', () => {
    expect(converterLista([1, 2, 3], (numero) => numero * 2)).toEqual([2, 4, 6]);
  });

  it('mantém nula a lista nula', () => {
    expect(converterLista(null, (numero: number) => numero * 2)).toBeNull();
  });

  it('mantém indefinida a lista indefinida', () => {
    expect(converterLista(undefined, (numero: number) => numero * 2)).toBeUndefined();
  });

  it('mantém vazia a lista vazia', () => {
    expect(converterLista([], (numero: number) => numero * 2)).toEqual([]);
  });
});
