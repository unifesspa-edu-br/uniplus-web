import { describe, expect, it } from 'vitest';

import { nomeDoIrAoCampo } from './nome-do-ir-ao-campo';

describe('nomeDoIrAoCampo', () => {
  it('começa por "Ir ao campo" e diz a mensagem da causa, sem o código técnico', () => {
    expect(nomeDoIrAoCampo(1, 'Falta o formulário da fase Habilitação.')).toBe(
      'Ir ao campo da causa 1: Falta o formulário da fase Habilitação.',
    );
  });

  it('dá nomes diferentes a duas causas com a mesma mensagem', () => {
    expect(nomeDoIrAoCampo(1, 'Igual.')).not.toBe(nomeDoIrAoCampo(2, 'Igual.'));
  });
});
