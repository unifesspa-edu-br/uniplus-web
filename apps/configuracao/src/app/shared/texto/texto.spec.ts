import { describe, expect, it } from 'vitest';
import { comPontoFinal } from './texto';

describe('comPontoFinal', () => {
  it('acrescenta o ponto quando falta e mantém a pontuação que já existe', () => {
    expect(comPontoFinal('Erro interno ')).toBe('Erro interno.');
    expect(comPontoFinal('Falhou.')).toBe('Falhou.');
    expect(comPontoFinal('Falhou!')).toBe('Falhou!');
  });
});
