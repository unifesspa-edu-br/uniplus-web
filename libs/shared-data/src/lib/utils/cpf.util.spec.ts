import { isValidCpf } from './cpf.util';

describe('cpf.util', () => {
  describe('isValidCpf', () => {
    it('should validate a correct CPF', () => {
      expect(isValidCpf('163.287.930-14')).toBe(true);
    });

    it('should reject all same digits', () => {
      expect(isValidCpf('111.111.111-11')).toBe(false);
    });

    it('should reject invalid CPF', () => {
      expect(isValidCpf('123.456.789-00')).toBe(false);
    });
  });
});
