import { describe, expect, it } from 'vitest';
import { contadorDeFalhas } from './contador-de-falhas';

describe('contadorDeFalhas', () => {
  it('soma as falhas repetidas, recomeça na falha não repetida e zera no sucesso', () => {
    const falhas = contadorDeFalhas();
    falhas.registrarFalha(false);
    falhas.registrarFalha(true);
    falhas.registrarFalha(true);
    expect(falhas.valor()).toBe(3);

    falhas.registrarFalha(false);
    expect(falhas.valor()).toBe(1);

    falhas.registrarSucesso();
    expect(falhas.valor()).toBe(0);
  });
});
