import { describe, expect, it } from 'vitest';
import { normalizarParaBusca } from './busca.util';

describe('normalizarParaBusca', () => {
  it.each([
    ['Técnico em Enfermagem', 'tecnico em enfermagem'],
    ['SELEÇÃO', 'selecao'],
    ['  Marabá  ', 'maraba'],
    ['009/2026', '009/2026'],
    ['', ''],
  ])('%j vira %j', (entrada, esperado) => {
    expect(normalizarParaBusca(entrada)).toBe(esperado);
  });
});
