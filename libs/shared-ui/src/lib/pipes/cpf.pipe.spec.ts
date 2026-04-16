import { CpfPipe } from './cpf.pipe';

describe('CpfPipe', () => {
  const pipe = new CpfPipe();

  it('should format CPF correctly', () => {
    expect(pipe.transform('52998224725')).toBe('529.982.247-25');
  });

  it('should mask CPF correctly', () => {
    expect(pipe.transform('52998224725', true)).toBe('***.***.***-25');
  });

  it('should handle empty value', () => {
    expect(pipe.transform(null)).toBe('');
  });
});
