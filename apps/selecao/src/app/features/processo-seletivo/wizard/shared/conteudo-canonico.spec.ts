import { describe, expect, it } from 'vitest';

import { mesmoConteudo } from './conteudo-canonico';

describe('mesmoConteudo', () => {
  it('ignora a ordem em que as chaves foram escritas', () => {
    expect(mesmoConteudo({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it('trata chave com undefined como chave ausente', () => {
    expect(mesmoConteudo({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(mesmoConteudo({ a: 1 }, { a: 1, b: undefined })).toBe(true);
  });

  it('não confunde null com ausente', () => {
    expect(mesmoConteudo({ a: 1, b: null }, { a: 1 })).toBe(false);
    expect(mesmoConteudo({ a: 1 }, { a: 1, b: null })).toBe(false);
  });

  it('diferencia valores e chaves distintas', () => {
    expect(mesmoConteudo({ a: 1 }, { a: 2 })).toBe(false);
    expect(mesmoConteudo({ a: 1 }, { b: 1 })).toBe(false);
    expect(mesmoConteudo({ a: '1' }, { a: 1 })).toBe(false);
  });

  it('considera a ordem dos itens de uma lista', () => {
    expect(mesmoConteudo([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(mesmoConteudo([1, 2, 3], [3, 2, 1])).toBe(false);
    expect(mesmoConteudo([1, 2], [1, 2, 3])).toBe(false);
  });

  it('distingue posição vazia de valor na lista', () => {
    expect(mesmoConteudo(new Array(1), [1])).toBe(false);
    expect(mesmoConteudo([1], new Array(1))).toBe(false);
  });

  it('não confunde lista com objeto', () => {
    expect(mesmoConteudo([], {})).toBe(false);
    expect(mesmoConteudo({}, [])).toBe(false);
  });

  it('compara em profundidade, com chaves em outra ordem em cada nível', () => {
    const um = { a: { x: [{ p: 1, q: 2 }], y: null }, b: 'z' };
    const outro = { b: 'z', a: { y: null, x: [{ q: 2, p: 1 }] } };
    expect(mesmoConteudo(um, outro)).toBe(true);
    expect(mesmoConteudo(um, { ...outro, a: { y: null, x: [{ q: 2, p: 9 }] } })).toBe(false);
  });

  it('encerra cedo em referências iguais, sem descer no conteúdo', () => {
    const interno = {};
    Object.defineProperty(interno, 'armadilha', {
      enumerable: true,
      get: () => {
        throw new Error('não deveria ler');
      },
    });
    expect(mesmoConteudo({ interno }, { interno })).toBe(true);
  });

  it('compara valores simples e vazios', () => {
    expect(mesmoConteudo(null, null)).toBe(true);
    expect(mesmoConteudo(undefined, undefined)).toBe(true);
    expect(mesmoConteudo(null, undefined)).toBe(false);
    expect(mesmoConteudo('a', 'a')).toBe(true);
  });
});
