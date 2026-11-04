import { describe, expect, it } from 'vitest';

import { comoComandoDeReferenciaTemporal } from './apuracao-da-idade';

describe('a política que ancora a apuração da idade', () => {
  const FASES = new Map([['INSCRICAO', 'id-inscricao']]);

  it('resolve a fase de código para identificador', () => {
    expect(
      comoComandoDeReferenciaTemporal(
        { tipo: 'INICIO_FASE', data: '', faseCodigo: 'INSCRICAO' },
        FASES,
      ),
    ).toEqual({
      tipo: 'INICIO_FASE',
      data: null,
      faseId: 'id-inscricao',
    });
  });

  it('tudo nulo remove a política', () => {
    expect(comoComandoDeReferenciaTemporal({ tipo: '', data: '', faseCodigo: '' }, FASES)).toEqual({
      tipo: null,
      data: null,
      faseId: null,
    });
  });
});
