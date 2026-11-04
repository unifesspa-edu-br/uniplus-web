import { describe, expect, it } from 'vitest';

import { analisarValorEmReais, formatarValorEmReais } from './valor-em-reais';

describe('analisarValorEmReais', () => {
  it.each([
    ['1.000', 1000],
    ['1.000,50', 1000.5],
    ['1000,50', 1000.5],
    ['1.234.567,89', 1234567.89],
    ['230', 230],
    ['230,00', 230],
    ['1,5', 1.5],
    ['  50  ', 50],
    ['0', 0],
  ])('lê %j como %d', (texto, esperado) => {
    expect(analisarValorEmReais(texto)).toBe(esperado);
  });

  /**
   * Formas que `Number` converteria em outro número, ou recusaria por engano.
   * O ponto de cada uma é não virar valor silenciosamente.
   */
  it.each([
    ['1e2'],
    ['0x10'],
    ['1.00'],
    ['1.0000'],
    ['1,234'],
    ['-5'],
    [''],
    [','],
    [',50'],
    ['.500'],
    ['1.000.50'],
    ['R$ 230'],
    ['mil'],
  ])('recusa %j', (texto) => {
    expect(analisarValorEmReais(texto)).toBeNull();
  });

  /**
   * Acima da faixa que o servidor grava — `numeric(12,2)` —, o próprio
   * `Number` deixa de representar o inteiro exatamente: `9007199254740993`
   * volta como `...992`, e valores maiores viram `Infinity`, que o JSON
   * serializa como `null`. Recusar é o mesmo princípio do resto: nunca
   * devolver número diferente do escrito.
   */
  it.each([
    ['9.007.199.254.740.993,00'],
    ['99.999.999.999,99'],
    ['12345678901'],
    ['1' + '0'.repeat(400)],
  ])('recusa %j por exceder o valor gravável', (texto) => {
    expect(analisarValorEmReais(texto)).toBeNull();
  });

  it('aceita o maior valor que o servidor grava', () => {
    expect(analisarValorEmReais('9.999.999.999,99')).toBe(9999999999.99);
  });

  /** `1.000` é mil em pt-BR; era esta leitura que gravava um real. */
  it('lê o separador de milhar como milhar, não como decimal', () => {
    expect(analisarValorEmReais('1.000')).toBe(1000);
    expect(analisarValorEmReais('1.000')).not.toBe(Number('1.000'));
  });
});

describe('formatarValorEmReais', () => {
  it.each([
    [230, '230,00'],
    [1000.5, '1.000,50'],
    [1234567.89, '1.234.567,89'],
    [0.5, '0,50'],
  ])('escreve %d como %j', (valor, esperado) => {
    expect(formatarValorEmReais(valor)).toBe(esperado);
  });

  /** O que sai da releitura precisa entrar de volta na validação. */
  it.each([230, 1000.5, 1234567.89, 0.5])('faz round-trip com %d', (valor) => {
    expect(analisarValorEmReais(formatarValorEmReais(valor))).toBe(valor);
  });
});
