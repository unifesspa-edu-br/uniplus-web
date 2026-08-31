import { describe, expect, it } from 'vitest';

import { decimalDoCampo, inteiroDoCampo } from './numero-do-campo';

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

  it('aceita valor grande que ainda cabe no número', () => {
    expect(decimalDoCampo('999999999')).toBe(999999999);
  });

  it('campo vazio não é número', () => {
    expect(decimalDoCampo('')).toBeNull();
    expect(inteiroDoCampo('   ')).toBeNull();
  });
});
