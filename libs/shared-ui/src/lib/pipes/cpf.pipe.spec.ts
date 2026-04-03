import { CpfPipe } from './cpf.pipe';

describe('CpfPipe', () => {
  const pipe = new CpfPipe();

  it('should format CPF correctly', () => {
    expect(pipe.transform('12345678901')).toBe('123.456.789-01');
  });

  it('should mask CPF correctly', () => {
    expect(pipe.transform('12345678901', true)).toBe('***.456.***-01');
  });

  it('should handle empty value', () => {
    expect(pipe.transform(null)).toBe('');
  });
});
