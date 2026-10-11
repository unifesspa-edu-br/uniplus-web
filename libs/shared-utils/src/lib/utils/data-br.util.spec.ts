import { describe, expect, it } from 'vitest';

import {
  deslocamentoDoFusoEmMinutos,
  formatarDataBr,
  FUSO_INSTITUCIONAL,
  instanteDaHoraDeParede,
  lerDataIso,
} from './data-br.util';

/**
 * Brasília observou horário de verão até fevereiro de 2019; Belém, só até 1988. Em 01/12/2018, 02:30 UTC
 * ainda era 30/11 em Belém (UTC−3) e já era 01/12 em São Paulo (UTC−2): o único tipo de instante
 * em que os dois fusos discordam do dia civil.
 */
const VIRADA_DO_DIA_NO_VERAO = '2018-12-01T02:30:00Z';

describe('formatarDataBr', () => {
  it('conta o dia civil no fuso institucional, e não no de Brasília', () => {
    expect(FUSO_INSTITUCIONAL).toBe('America/Belem');
    expect(formatarDataBr(VIRADA_DO_DIA_NO_VERAO, 'datetime')).toBe('30/11/2018, 23:30');
  });

  it('formata no fuso informado quando o contrato traz outro', () => {
    expect(formatarDataBr(VIRADA_DO_DIA_NO_VERAO, 'datetime', 'America/Sao_Paulo')).toBe(
      '01/12/2018, 00:30',
    );
  });

  it('lê a hora de parede sem zona no mesmo fuso em que formata', () => {
    // 00:30 de 01/12/2018 é o mesmo dia escrito, qualquer que seja o fuso informado.
    expect(formatarDataBr('2018-12-01T00:30', 'datetime', 'America/Sao_Paulo')).toBe(
      '01/12/2018, 00:30',
    );
    expect(formatarDataBr('2018-12-01T00:30', 'datetime')).toBe('01/12/2018, 00:30');
  });

  /**
   * Belém começou o horário de verão à meia-noite de 25/10/1987, e São Paulo à de 04/11/2018: a
   * meia-noite desses dias não existe. Uma data pura convertida em instante cairia no dia
   * anterior — e data de nascimento é data pura.
   */
  it('mostra a data pura como o dia escrito, mesmo quando a meia-noite não existe no fuso', () => {
    expect(formatarDataBr('1987-10-25')).toBe('25/10/1987');
    expect(formatarDataBr('25-10-1987')).toBe('25/10/1987');
    expect(formatarDataBr('2018-11-04', 'short', 'America/Sao_Paulo')).toBe('04/11/2018');
    // Samoa pulou o dia 30/12/2011 inteiro: nenhuma hora dele existiu, e a data continua sendo ela.
    expect(formatarDataBr('2011-12-30', 'short', 'Pacific/Apia')).toBe('30/12/2011');
  });

  it('avança a hora de parede que cai na lacuna do horário de verão', () => {
    // 00:30 de 25/10/1987 não existiu em Belém: o relógio saltou de 00:00 para 01:00.
    expect(formatarDataBr('1987-10-25T00:30', 'datetime')).toBe('25/10/1987, 01:30');
  });

  it('mostra os segundos no formato que os pede', () => {
    expect(formatarDataBr('2026-06-05T15:30:42Z', 'datetimeSeconds')).toBe('05/06/2026, 12:30:42');
  });

  it('devolve texto vazio para entrada vazia ou inválida', () => {
    expect(formatarDataBr(null)).toBe('');
    expect(formatarDataBr('2026-02-29')).toBe('');
    expect(formatarDataBr('não é data')).toBe('');
  });
});

describe('instanteDaHoraDeParede', () => {
  it('converte a hora de parede pelo deslocamento do fuso naquela data', () => {
    const meiaNoiteEMeia = { ano: 2018, mes: 12, dia: 1, hora: 0, minuto: 30, segundo: 0 };

    expect(instanteDaHoraDeParede(meiaNoiteEMeia).toISOString()).toBe('2018-12-01T03:30:00.000Z');
    expect(instanteDaHoraDeParede(meiaNoiteEMeia, 'America/Sao_Paulo').toISOString()).toBe(
      '2018-12-01T02:30:00.000Z',
    );
  });
});

describe('lerDataIso', () => {
  it('ancora a data à meia-noite UTC e recusa data inexistente', () => {
    expect(lerDataIso(' 1987-10-25 ')?.toISOString()).toBe('1987-10-25T00:00:00.000Z');
    expect(lerDataIso('2026-02-29')).toBeNull();
  });
});

describe('deslocamentoDoFusoEmMinutos', () => {
  it('pergunta o deslocamento ao fuso, na data, em vez de fixá-lo', () => {
    const instante = new Date(VIRADA_DO_DIA_NO_VERAO);

    expect(deslocamentoDoFusoEmMinutos(instante)).toBe(-180);
    expect(deslocamentoDoFusoEmMinutos(instante, 'America/Sao_Paulo')).toBe(-120);
  });
});
