import { describe, expect, it } from 'vitest';
import { CODIGO_CADASTRO_FORMATO } from './codigo-cadastro.util';

describe('formato do código de cadastro', () => {
  it.each(['A', 'LEI_12711', 'ANALISE_DOCUMENTAL'])('aceita %s', (codigo) => {
    expect(CODIGO_CADASTRO_FORMATO.test(codigo)).toBe(true);
  });

  it.each([' A', 'A ', 'abc', 'Á', 'COR__RACA', 'COR_', '_AC', '1AC'])('recusa %s', (codigo) => {
    expect(CODIGO_CADASTRO_FORMATO.test(codigo)).toBe(false);
  });
});
