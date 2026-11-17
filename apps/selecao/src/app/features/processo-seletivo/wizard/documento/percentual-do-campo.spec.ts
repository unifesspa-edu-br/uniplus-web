import { describe, expect, it } from 'vitest';

import { fracaoDoPercentual, percentualDaFracao } from './percentual-do-campo';
import { fracaoQueVale } from './valor-que-vale';

describe('percentual do campo', () => {
  it('escreve a fração como percentual com vírgula, sem ruído de ponto flutuante', () => {
    expect(percentualDaFracao(0.3)).toBe('30');
    expect(percentualDaFracao(0.0725)).toBe('7,25');
    expect(percentualDaFracao(0)).toBe('0');
  });

  it('deixa o campo vazio quando não há fração', () => {
    expect(percentualDaFracao(undefined)).toBe('');
  });

  it('lê o percentual como fração', () => {
    expect(fracaoDoPercentual('7,25')).toBe(0.0725);
    expect(fracaoDoPercentual('100')).toBe(1);
  });

  it.each(['', 'abc', '1e2', '9'.repeat(400)])('não faz fração de "%s"', (texto) => {
    expect(fracaoDoPercentual(texto)).toBeUndefined();
  });

  it('devolve a fração lida como estava enquanto o campo não mudou', () => {
    expect(fracaoQueVale(1e-7, percentualDaFracao(1e-7))).toBe(1e-7);
  });
});
