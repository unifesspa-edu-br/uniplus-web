import { describe, expect, it } from 'vitest';

import { instanteEmUtc } from './instante-em-utc';
import { instanteQueVale } from './valor-que-vale';

describe('instante do documento', () => {
  it('escreve a hora de parede do fuso institucional em UTC com o sufixo Z', () => {
    expect(instanteEmUtc('2027-01-10T00:00')).toBe('2027-01-10T03:00:00Z');
  });

  it('mantém os segundos que o campo traz', () => {
    expect(instanteEmUtc('2027-01-20T23:59:59')).toBe('2027-01-21T02:59:59Z');
  });

  it.each(['', '   ', '2027-13-45T10:00', 'amanhã'])('não faz instante de "%s"', (campo) => {
    expect(instanteEmUtc(campo)).toBeUndefined();
  });
});

describe('instante que vale', () => {
  it('devolve o instante lido como estava enquanto o campo não mudou', () => {
    expect(instanteQueVale('2027-01-10T03:00:00.5Z', '2027-01-10T00:00')).toBe(
      '2027-01-10T03:00:00.5Z',
    );
  });

  it('interpreta o campo quando a pessoa o mudou', () => {
    expect(instanteQueVale('2027-01-10T03:00:00Z', '2027-02-01T08:30')).toBe(
      '2027-02-01T11:30:00Z',
    );
  });

  it('tira o instante quando a pessoa esvazia o campo', () => {
    expect(instanteQueVale('2027-01-10T03:00:00Z', '')).toBeUndefined();
  });

  it('mantém o instante que o calendário não reconhece, enquanto o campo não for tocado', () => {
    expect(instanteQueVale('2027-13-45T99:99:99Z', '')).toBe('2027-13-45T99:99:99Z');
  });
});
