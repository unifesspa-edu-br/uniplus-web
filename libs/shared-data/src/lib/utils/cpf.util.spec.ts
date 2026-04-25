import { isValidCpf, formatCpf, formatCpfProgressive, maskCpf } from './cpf.util';

describe('cpf.util', () => {
  describe('isValidCpf', () => {
    it('should validate a correct CPF', () => {
      expect(isValidCpf('529.982.247-25')).toBe(true);
    });

    it('should reject all same digits', () => {
      expect(isValidCpf('111.111.111-11')).toBe(false);
    });

    it('should reject invalid CPF', () => {
      expect(isValidCpf('123.456.789-00')).toBe(false);
    });
  });

  describe('formatCpf', () => {
    it('should format CPF digits', () => {
      expect(formatCpf('52998224725')).toBe('529.982.247-25');
    });
  });

  describe('maskCpf', () => {
    it('should mask CPF for LGPD', () => {
      expect(maskCpf('52998224725')).toBe('***.***.***-25');
    });
  });

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
});
