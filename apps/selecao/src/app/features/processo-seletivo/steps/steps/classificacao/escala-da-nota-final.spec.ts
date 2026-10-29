import { describe, expect, it } from 'vitest';

import {
  escalaDaNotaFinal,
  escalaDaNotaFinalComoTexto,
  escalaDaNotaFinalIlegivel,
  faixaDaNotaFinal,
  leituraDaEscalaDaNotaFinal,
} from './escala-da-nota-final';

describe('escala da nota final', () => {
  it('lê a vírgula como casa decimal e o inteiro como está', () => {
    expect(escalaDaNotaFinal('10')).toBe(10);
    expect(escalaDaNotaFinal('1000')).toBe(1000);
    expect(escalaDaNotaFinal('1,5')).toBe(1.5);
    expect(escalaDaNotaFinal('100,5')).toBe(100.5);
  });

  it('recusa o ponto de milhar em vez de ler 1.000 como um', () => {
    expect(escalaDaNotaFinal('1.000')).toBeNull();
    expect(escalaDaNotaFinal('1.000.000')).toBeNull();
    expect(escalaDaNotaFinal('7.500')).toBeNull();
    expect(escalaDaNotaFinalIlegivel('1.000')).toBe(true);
  });

  it('não lê o que não é número nem o que passa de quatro casas', () => {
    expect(escalaDaNotaFinal('')).toBeNull();
    expect(escalaDaNotaFinal('abc')).toBeNull();
    expect(escalaDaNotaFinal('-10')).toBeNull();
    expect(escalaDaNotaFinal('10,12345')).toBeNull();
    expect(escalaDaNotaFinal('10,1234')).toBe(10.1234);
  });

  it('só tem texto ilegível quando há texto que não é número', () => {
    expect(escalaDaNotaFinalIlegivel('')).toBe(false);
    expect(escalaDaNotaFinalIlegivel('  ')).toBe(false);
    expect(escalaDaNotaFinalIlegivel('10,12345')).toBe(true);
  });

  it('devolve ao campo a escala do servidor', () => {
    expect(escalaDaNotaFinalComoTexto(null)).toBe('');
    expect(escalaDaNotaFinalComoTexto(100)).toBe('100');
    expect(escalaDaNotaFinalComoTexto('100.5')).toBe('100,5');
    expect(escalaDaNotaFinalComoTexto(1000.125)).toBe('1000,125');
  });

  it('mostra a faixa com até quatro casas', () => {
    expect(faixaDaNotaFinal('1000')).toBe('0 a 1000');
    expect(faixaDaNotaFinal('0,0001')).toBe('0 a 0,0001');
    expect(faixaDaNotaFinal('')).toBeNull();
  });

  it.each(['0', '-5'])('não mostra faixa para a escala %s, que o servidor recusa', (texto) => {
    expect(faixaDaNotaFinal(texto)).toBeNull();
    expect(leituraDaEscalaDaNotaFinal(texto)).toBe(texto);
  });
});
