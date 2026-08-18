import { describe, it, expect, beforeEach } from 'vitest';

import { DateBrPipe } from './date-br.pipe';

const DATA_VALIDA_RAW = '2026-06-05T15:30:00Z';
const DATA_VALIDA = new Date(DATA_VALIDA_RAW);

describe('DateBrPipe', () => {
  let pipe: DateBrPipe;

  beforeEach(() => {
    pipe = new DateBrPipe();
  });

  it('exibe um texto vazio quando a entrada é inválida ou vazia', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('')).toBe('');
  });

  it('formata uma data válida no formato "short"', () => {
    expect(pipe.transform(DATA_VALIDA_RAW, 'short')).toBe('05/06/2026');
    expect(pipe.transform(DATA_VALIDA, 'short')).toBe('05/06/2026');
  });

  it('formata uma data válida no formato "datetime"', () => {
    expect(pipe.transform(DATA_VALIDA_RAW, 'datetime')).toBe('05/06/2026, 12:30');
    expect(pipe.transform(DATA_VALIDA, 'datetime')).toBe('05/06/2026, 12:30');
  });

  it('formata uma data válida no formato "long"', () => {
    expect(pipe.transform(DATA_VALIDA_RAW, 'long')).toBe('05 de junho de 2026');
    expect(pipe.transform(DATA_VALIDA, 'long')).toBe('05 de junho de 2026');
  });

  it('formata uma data válida no formato "shortMonth"', () => {
    expect(pipe.transform(DATA_VALIDA_RAW, 'shortMonth')).toBe('05 jun 2026');
    expect(pipe.transform(DATA_VALIDA, 'shortMonth')).toBe('05 jun 2026');
  });

  it('formata uma data válida sem deslocamento de fuso', () => {
    const data = '2026-06-01T12:30:00';
    expect(pipe.transform(data, 'short')).toBe('01/06/2026');
    expect(pipe.transform(data, 'datetime')).toBe('01/06/2026, 12:30');
    expect(pipe.transform(data, 'shortMonth')).toBe('01 jun 2026');
    expect(pipe.transform(data, 'long')).toBe('01 de junho de 2026');
  });

  it('exibe um texto vazio quando a data é inexistente', () => {
    const dataInexistente = '2026-02-29T12:30:00';
    expect(pipe.transform(dataInexistente, 'short')).toBe('');
    expect(pipe.transform(dataInexistente, 'datetime')).toBe('');
    expect(pipe.transform(dataInexistente, 'shortMonth')).toBe('');
    expect(pipe.transform(dataInexistente, 'long')).toBe('');
  });

  it('preserva o instante quando a entrada traz fuso explícito', () => {
    // 00:00Z = 21:00 do dia anterior em America/Belem (UTC−3)
    expect(pipe.transform('2026-08-11T00:00:00Z', 'datetime')).toBe('10/08/2026, 21:00');
  });

  it('não desloca o dia em data pura', () => {
    expect(pipe.transform('2026-06-05', 'short')).toBe('05/06/2026');
  });

  it('exibe texto vazio para Date inválido', () => {
    expect(pipe.transform(new Date('data-invalida'))).toBe('');
  });
});
