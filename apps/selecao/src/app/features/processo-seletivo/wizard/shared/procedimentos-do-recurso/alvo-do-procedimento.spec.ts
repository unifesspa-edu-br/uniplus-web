import { describe, expect, it } from 'vitest';

import { alvoLidoDoServidor, alvoParaComando, mesmoAlvo } from './alvo-do-procedimento';

describe('mesmo alvo', () => {
  it('reconhece o tipo inteiro quando os dois estão sem alvo', () => {
    expect(mesmoAlvo(null, null)).toBe(true);
  });

  it('distingue o tipo inteiro de um alvo', () => {
    expect(mesmoAlvo(null, { areaDoEnem: 'Matemática' })).toBe(false);
    expect(mesmoAlvo({ itemDeAvaliacaoId: 'item-1' }, null)).toBe(false);
  });

  it('reconhece o mesmo item e distingue itens diferentes', () => {
    expect(mesmoAlvo({ itemDeAvaliacaoId: 'item-1' }, { itemDeAvaliacaoId: 'item-1' })).toBe(true);
    expect(mesmoAlvo({ itemDeAvaliacaoId: 'item-1' }, { itemDeAvaliacaoId: 'item-2' })).toBe(false);
  });

  it('reconhece a mesma área do ENEM e distingue áreas diferentes', () => {
    expect(mesmoAlvo({ areaDoEnem: 'Matemática' }, { areaDoEnem: 'Matemática' })).toBe(true);
    expect(mesmoAlvo({ areaDoEnem: 'Matemática' }, { areaDoEnem: 'Linguagens' })).toBe(false);
  });

  it('não confunde item com área de mesmo valor', () => {
    expect(mesmoAlvo({ itemDeAvaliacaoId: 'x' }, { areaDoEnem: 'x' })).toBe(false);
    expect(mesmoAlvo({ areaDoEnem: 'x' }, { itemDeAvaliacaoId: 'x' })).toBe(false);
  });
});

describe('alvo no limite com a API', () => {
  it('lê o item devolvido pelo servidor', () => {
    expect(alvoLidoDoServidor({ itemDeAvaliacaoId: 'item-1', areaDoEnem: null })).toEqual({
      itemDeAvaliacaoId: 'item-1',
    });
  });

  it('lê a área devolvida pelo servidor', () => {
    expect(alvoLidoDoServidor({ itemDeAvaliacaoId: null, areaDoEnem: 'Matemática' })).toEqual({
      areaDoEnem: 'Matemática',
    });
  });

  it('lê como tipo inteiro o alvo ausente ou sem item e sem área', () => {
    expect(alvoLidoDoServidor(null)).toBeNull();
    expect(alvoLidoDoServidor({ itemDeAvaliacaoId: null, areaDoEnem: null })).toBeNull();
  });

  it('envia o campo que a forma não tem como nulo', () => {
    expect(alvoParaComando({ itemDeAvaliacaoId: 'item-1' })).toEqual({
      itemDeAvaliacaoId: 'item-1',
      areaDoEnem: null,
    });
    expect(alvoParaComando({ areaDoEnem: 'Matemática' })).toEqual({
      itemDeAvaliacaoId: null,
      areaDoEnem: 'Matemática',
    });
  });

  it('envia o tipo inteiro sem alvo', () => {
    expect(alvoParaComando(null)).toBeNull();
  });
});
