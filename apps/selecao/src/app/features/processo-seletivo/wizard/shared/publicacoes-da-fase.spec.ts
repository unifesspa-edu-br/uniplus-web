import { describe, expect, it } from 'vitest';

import { AVISO, DEFINITIVO, PRELIMINAR } from '../passos/cronograma/cronograma-do-certame.testing';
import { publicaResultadoDefinitivo } from './publicacoes-da-fase';

describe('publicaResultadoDefinitivo', () => {
  it('é verdadeiro quando alguma publicação é o resultado definitivo', () => {
    expect(publicaResultadoDefinitivo([DEFINITIVO])).toBe(true);
    expect(publicaResultadoDefinitivo([PRELIMINAR, DEFINITIVO])).toBe(true);
  });

  it('é falso sem publicação ou só com preliminar e ato que não é resultado', () => {
    expect(publicaResultadoDefinitivo([])).toBe(false);
    expect(publicaResultadoDefinitivo([PRELIMINAR, AVISO])).toBe(false);
  });
});
