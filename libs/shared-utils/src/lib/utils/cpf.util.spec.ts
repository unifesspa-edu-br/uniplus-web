import { describe, expect, it } from 'vitest';
import { cpfRevelavel, formatCpfProgressive, mascararCpf } from './cpf.util';

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
    expect(formatCpfProgressive('abc163.287.930-14xyz')).toBe('163.287.930-14');
  });
});

describe('mascararCpf', () => {
  it('oculta os três primeiros dígitos e os verificadores', () => {
    expect(mascararCpf('699.598.363-71')).toBe('***.598.363-**');
  });

  it.each([['6995983637'], ['699598363712'], [''], [null], [undefined]])(
    'oculta tudo, sem completar com zeros, quando "%s" não tem 11 dígitos',
    (cpf) => {
      expect(mascararCpf(cpf)).toBe('***.***.***-**');
    },
  );
});

describe('cpfRevelavel', () => {
  it('separa os trechos ocultos e diz o que a máscara deixa ver', () => {
    expect(cpfRevelavel('69959836371')).toEqual({
      mascarado: [
        { texto: '***', oculto: true },
        { texto: '.598.363-', oculto: false },
        { texto: '**', oculto: true },
      ],
      visivel: '598.363',
      revelado: '699.598.363-71',
    });
  });

  it('não tem o que revelar quando o CPF não tem 11 dígitos', () => {
    expect(cpfRevelavel('6995983637')).toEqual({
      mascarado: [{ texto: '***.***.***-**', oculto: true }],
      visivel: '',
      revelado: null,
    });
  });
});
