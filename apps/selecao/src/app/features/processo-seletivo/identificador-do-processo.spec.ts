import { describe, expect, it } from 'vitest';
import { ehIdentificadorDoProcesso } from './identificador-do-processo';

describe('ehIdentificadorDoProcesso', () => {
  it('aceita identificador completo sem distinguir maiúsculas', () => {
    expect(ehIdentificadorDoProcesso('ABCDEF12-1234-5678-9ABC-ABCDEF123456')).toBe(true);
  });

  it.each([
    '',
    '11111111-1111-1111-1111-11111111111',
    'g1111111-1111-1111-1111-111111111111',
    ' 11111111-1111-1111-1111-111111111111',
  ])('recusa identificador malformado: %s', (id) => {
    expect(ehIdentificadorDoProcesso(id)).toBe(false);
  });
});
