import { describe, expect, it } from 'vitest';

import { vigenteNoDia } from './vigencia';

describe('vigenteNoDia', () => {
  it('trata a data de fim como o primeiro dia sem validade', () => {
    const encerra = { vigenciaInicio: '2026-01-01', vigenciaFim: '2026-06-30' };

    expect(vigenteNoDia(encerra, '2026-06-29')).toBe(true);
    expect(vigenteNoDia(encerra, '2026-06-30')).toBe(false);
  });

  it('só vale a partir do dia de início e não tem fim quando ele é nulo', () => {
    const aberta = { vigenciaInicio: '2026-07-01', vigenciaFim: null };

    expect(vigenteNoDia(aberta, '2026-06-30')).toBe(false);
    expect(vigenteNoDia(aberta, '2026-07-01')).toBe(true);
    expect(vigenteNoDia(aberta, '2030-01-01')).toBe(true);
  });
});
