import { describe, expect, it } from 'vitest';
import { formatDateBr, formatDateTimeBr, parseDate } from './date.util';

describe('Date Util', () => {
  const VALID_RAW_DATE = '2026-02-14T12:00:00';
  const INVALID_RAW_DATE = '2026-02-14T25:00:00';
  const DATE = new Date(VALID_RAW_DATE);
  const PLACEHOLDER_DATA_INVALIDA = '—';

  describe('formatDateBr()', () => {
    it('formata uma entrada de data em texto bruto para a localidade pt-br', () => {
      expect(formatDateBr(VALID_RAW_DATE)).toBe('14/02/2026');
    });

    it('formata uma entrada de data para a localidade pt-br', () => {
      expect(formatDateBr(DATE)).toBe('14/02/2026');
    });

    it('retorna um "—" quando a entrada de data e hora em texto bruto é inválida', () => {
      expect(formatDateBr(INVALID_RAW_DATE)).toBe(PLACEHOLDER_DATA_INVALIDA);
    });

    it('retorna um "—" quando a entrada de um objeto de data e hora é inválida', () => {
      expect(formatDateBr(new Date(INVALID_RAW_DATE))).toBe(PLACEHOLDER_DATA_INVALIDA);
    });
  });

  describe('formatDateTimeBr()', () => {
    it('formata uma entrada de texto bruto de data e hora para o formato de data e hora na localidade pt-br', () => {
      expect(formatDateTimeBr(VALID_RAW_DATE)).toBe('14/02/2026, 12:00:00');
    });

    it('formata uma entrada de data e hora para o formato de data e hora na localidade pt-br', () => {
      expect(formatDateTimeBr(DATE)).toBe('14/02/2026, 12:00:00');
    });

    it('retorna um "—" quando a entrada de um texto bruto de data e hora é inválida', () => {
      expect(formatDateTimeBr(INVALID_RAW_DATE)).toBe(PLACEHOLDER_DATA_INVALIDA);
    });

    it('retorna um "—" quando a entrada de um objeto de data e hora é inválida', () => {
      expect(formatDateTimeBr(new Date(INVALID_RAW_DATE))).toBe(PLACEHOLDER_DATA_INVALIDA);
    });
  });

  describe('parseDate()', () => {
    describe('entradas válidas', () => {
      it.each([
        { input: '14/02/2025', expected: new Date(2025, 1, 14), descricao: 'dia/mês com 2 dígitos' },
        { input: '01/01/2026', expected: new Date(2026, 0, 1), descricao: 'primeiro do ano' },
        { input: '31/12/2026', expected: new Date(2026, 11, 31), descricao: 'último do ano' },
        { input: '29/02/2024', expected: new Date(2024, 1, 29), descricao: 'ano bissexto' },
        { input: '1/2/2025', expected: new Date(2025, 1, 1), descricao: 'dia/mês com 1 dígito' },
      ])('parseia "$input" — $descricao', ({ input, expected }) => {
        expect(parseDate(input)).toEqual(expected);
      });

      it('tolera espaços nas bordas', () => {
        expect(parseDate('  14/02/2025  ')).toEqual(new Date(2025, 1, 14));
      });

      it('limites do intervalo de ano são aceitos (1900 e 2100)', () => {
        expect(parseDate('01/01/1900')).toEqual(new Date(1900, 0, 1));
        expect(parseDate('31/12/2100')).toEqual(new Date(2100, 11, 31));
      });
    });

    describe('entradas inválidas (retorna null)', () => {
      it.each([
        { input: '', descricao: 'string vazia' },
        { input: '   ', descricao: 'apenas espaços' },
        { input: '14-02-2026', descricao: 'separador diferente de "/"' },
        { input: '14/02/2026/00', descricao: 'mais de 3 segmentos' },
        { input: '02/14/2026', descricao: 'mês 14 fora do intervalo' },
        { input: '32/01/2026', descricao: 'dia 32 fora do intervalo' },
        { input: '00/01/2026', descricao: 'dia 0 fora do intervalo' },
        { input: '01/00/2026', descricao: 'mês 0 fora do intervalo' },
        { input: '01/13/2026', descricao: 'mês 13 fora do intervalo' },
        { input: '01/01/26', descricao: 'ano com 2 dígitos' },
        { input: '01/01/26000', descricao: 'ano com 5 dígitos' },
        { input: 'aa/bb/cccc', descricao: 'caracteres não-numéricos' },
        { input: '01/01/-024', descricao: 'ano com sinal negativo' },
        { input: '29/02/2026', descricao: '29/02 em ano não bissexto' },
        { input: '30/02/2024', descricao: '30 de fevereiro nunca existe' },
        { input: '31/04/2026', descricao: '31 de abril nunca existe' },
        { input: '01/01/1899', descricao: 'ano anterior a 1900 (fora do domínio Uni+)' },
        { input: '01/01/2101', descricao: 'ano posterior a 2100 (fora do domínio Uni+)' },
      ])('retorna null para "$input" — $descricao', ({ input }) => {
        expect(parseDate(input)).toBeNull();
      });
    });
  });
});
