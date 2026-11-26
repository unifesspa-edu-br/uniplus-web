import { describe, expect, it } from 'vitest';

import { abaPelaTecla } from './aba-pela-tecla';

describe('o teclado nas abas', () => {
  it('as setas andam em círculo, Home e End vão às pontas, e outra tecla não troca de aba', () => {
    expect([abaPelaTecla('ArrowRight', 2, 3), abaPelaTecla('ArrowLeft', 0, 3)]).toEqual([0, 2]);
    expect([abaPelaTecla('Home', 2, 3), abaPelaTecla('End', 0, 3)]).toEqual([0, 2]);
    expect(abaPelaTecla('Enter', 1, 3)).toBeNull();
  });
});
