import { describe, expect, it } from 'vitest';
import { formatCpfProgressive } from './cpf-format.util';

describe('formatCpfProgressive', () => {
  it.each([
    ['', ''],
    ['1', '1'],
    ['123', '123'],
    ['1234', '123.4'],
    ['123456', '123.456'],
    ['1234567', '123.456.7'],
    ['123456789', '123.456.789'],
    ['1234567890', '123.456.789-0'],
    ['12345678901', '123.456.789-01'],
    ['1234567890199', '123.456.789-01'],
  ])('formata progressivamente "%s" como "%s"', (input, expected) => {
    expect(formatCpfProgressive(input)).toBe(expected);
  });

  it('retorna string vazia para null', () => {
    expect(formatCpfProgressive(null)).toBe('');
  });

  it('retorna string vazia para undefined', () => {
    expect(formatCpfProgressive(undefined)).toBe('');
  });

  it('remove caracteres não numéricos antes de formatar', () => {
    expect(formatCpfProgressive('abc529.982.247-25xyz')).toBe('529.982.247-25');
  });
});
