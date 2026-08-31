import { describe, expect, it } from 'vitest';

import { hojeNoFusoInstitucional } from './fuso-institucional';

describe('hoje no fuso institucional', () => {
  /**
   * O caso que `toISOString()` erra: 22h de 20/03 em Belém já é 21/03 em UTC.
   * Conferir vigência pela data UTC ofereceria um ato que só passa a valer
   * amanhã — e o servidor, que confere no próprio relógio, o recusaria.
   */
  it('devolve o dia local mesmo quando UTC já virou', () => {
    const noiteEmBelem = new Date('2026-03-21T01:30:00Z');

    expect(noiteEmBelem.toISOString().slice(0, 10)).toBe('2026-03-21');
    expect(hojeNoFusoInstitucional(noiteEmBelem)).toBe('2026-03-20');
  });

  it('devolve o mesmo dia quando UTC e o fuso coincidem', () => {
    expect(hojeNoFusoInstitucional(new Date('2026-03-20T15:00:00Z'))).toBe('2026-03-20');
  });

  it('formata como AAAA-MM-DD, comparável com as datas do contrato', () => {
    expect(hojeNoFusoInstitucional(new Date('2026-01-05T12:00:00Z'))).toBe('2026-01-05');
  });
});
