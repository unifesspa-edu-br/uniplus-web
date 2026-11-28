import { describe, expect, it } from 'vitest';

import { formatarDecimalExato, formatarMoeda } from './decimal-exato';

describe('formatarDecimalExato', () => {
  it('preserva a precisão e usa vírgula decimal sem separador de milhar', () => {
    expect(formatarDecimalExato('12345678901234567890.123456789')).toBe(
      '12345678901234567890,123456789',
    );
    expect(formatarDecimalExato('-0.5')).toBe('-0,5');
    expect(formatarDecimalExato('7')).toBe('7');
    expect(formatarDecimalExato('1000')).toBe('1000');
    expect(formatarDecimalExato('abc')).toBe('abc');
  });
});

describe('formatarMoeda', () => {
  it('formata reais sem perder precisão e preserva texto que não é decimal', () => {
    expect(formatarMoeda('12345678901234567890.123')).toBe('R$ 12.345.678.901.234.567.890,123');
    expect(formatarMoeda('-1000.5')).toBe('-R$ 1.000,50');
    expect(formatarMoeda('abc')).toBe('abc');
  });
});
