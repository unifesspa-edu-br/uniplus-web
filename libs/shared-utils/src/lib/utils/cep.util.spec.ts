import { formatarCep } from './cep.util';

describe('formatarCep', () => {
  it('põe o hífen no CEP de oito dígitos', () => {
    expect(formatarCep('68900000')).toBe('68900-000');
  });

  it('mantém o CEP que já tem hífen', () => {
    expect(formatarCep('68900-000')).toBe('68900-000');
  });

  it('devolve como veio o texto com menos ou mais de oito dígitos', () => {
    expect(formatarCep('6890000')).toBe('6890000');
    expect(formatarCep('689000001')).toBe('689000001');
  });

  it('devolve como veio o texto com letras, sem máscara parcial', () => {
    expect(formatarCep('68900A00')).toBe('68900A00');
  });

  it('devolve como veio o texto com espaços, sem máscara parcial', () => {
    expect(formatarCep(' 68900000 ')).toBe(' 68900000 ');
    expect(formatarCep('68900 000')).toBe('68900 000');
  });

  it('devolve vazio quando não há valor', () => {
    expect(formatarCep(null)).toBe('');
    expect(formatarCep(undefined)).toBe('');
  });
});
