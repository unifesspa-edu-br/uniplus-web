import { describe, expect, it } from 'vitest';

import {
  decimalDoCampo,
  decimalNaForma,
  inteiroDoCampo,
  inteiroNaForma,
  leituraDoCampoDecimal,
} from './numero-do-campo';

describe('leitura dos campos numéricos do editor', () => {
  it('lê o ponto como separador decimal, não como agrupador', () => {
    expect(decimalDoCampo('0.5')).toBe(0.5);
    expect(decimalDoCampo('0,5')).toBe(0.5);
  });

  it('recusa notação que nenhum destes campos usa', () => {
    expect(decimalDoCampo('1e2')).toBeNull();
    expect(decimalDoCampo('0x10')).toBeNull();
    expect(decimalDoCampo('-1')).toBeNull();
    expect(inteiroDoCampo('1.5')).toBeNull();
  });

  /**
   * Uma sequência longa demais de dígitos passa na forma e estoura o alcance do
   * número. `Infinity` não é recusado por quem só confere se a conversão deu
   * certo, e a serialização JSON o manda no corpo como `null` — o campo chegaria
   * ao servidor apagado, e não recusado, sem nada dizer a quem digitou.
   */
  it('recusa o que estoura o alcance do número, em vez de virar Infinity', () => {
    const digitosDemais = '9'.repeat(309);

    expect(Number(digitosDemais)).toBe(Number.POSITIVE_INFINITY);
    expect(decimalDoCampo(digitosDemais)).toBeNull();
    expect(inteiroDoCampo(digitosDemais)).toBeNull();
  });

  it('confere só a forma do inteiro, sem teto de alcance', () => {
    expect(inteiroNaForma('007')).toBe(7);
    expect(inteiroNaForma('9'.repeat(309))).toBe(Number.POSITIVE_INFINITY);
    expect(inteiroNaForma('1.5')).toBeNull();
  });

  it('confere só a forma do decimal, com vírgula ou ponto', () => {
    expect(decimalNaForma('0,5')).toBe(0.5);
    expect(decimalNaForma('9'.repeat(309))).toBe(Number.POSITIVE_INFINITY);
    expect(decimalNaForma('1e2')).toBeNull();
  });

  it('aceita valor grande que ainda cabe no número', () => {
    expect(decimalDoCampo('999999999')).toBe(999999999);
  });

  it('campo vazio não é número', () => {
    expect(decimalDoCampo('')).toBeNull();
    expect(inteiroDoCampo('   ')).toBeNull();
  });

  it('lê em consulta o número do campo, e o texto que não é número como foi gravado', () => {
    expect(leituraDoCampoDecimal('1.20')).toBe(1.2);
    expect(leituraDoCampoDecimal('400')).toBe(400);
    expect(leituraDoCampoDecimal('')).toBe('');
    expect(leituraDoCampoDecimal('1e2')).toBe('1e2');
  });
});

describe('conversão do campo para número', () => {
  /**
   * O defeito que esta gramática existe para impedir: ler o ponto como
   * agrupador devolveria 5 para `0.5`, e o servidor aceitaria — 5 é peso
   * válido, e a classificação rodaria com o dobro em ordem de grandeza.
   */
  it('lê o ponto como separador decimal, não como agrupador', () => {
    expect(decimalDoCampo('0.5')).toBe(0.5);
    expect(decimalDoCampo('2.75')).toBe(2.75);
  });

  it('aceita vírgula como separador decimal', () => {
    expect(decimalDoCampo('0,5')).toBe(0.5);
    expect(decimalDoCampo('2,5')).toBe(2.5);
  });

  it('devolve nulo para campo vazio, e não zero', () => {
    expect(decimalDoCampo('')).toBeNull();
    expect(decimalDoCampo('   ')).toBeNull();
  });

  it('devolve nulo para texto que não é número', () => {
    expect(decimalDoCampo('dois')).toBeNull();
  });

  /** `Number` leria `1e2` como 100 e `0x10` como 16; nenhum é peso. */
  it('recusa notação científica e hexadecimal', () => {
    expect(decimalDoCampo('1e2')).toBeNull();
    expect(decimalDoCampo('0x10')).toBeNull();
  });

  it('recusa sinal negativo, que nenhum destes campos admite', () => {
    expect(decimalDoCampo('-1')).toBeNull();
  });

  it('preserva o zero declarado', () => {
    expect(decimalDoCampo('0')).toBe(0);
  });
});
