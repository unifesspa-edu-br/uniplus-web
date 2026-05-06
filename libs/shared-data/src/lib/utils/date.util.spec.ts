import { describe, it, expect } from 'vitest';
import { formatDateBr, formatDateTimeBr, parseDate } from './date.util';

describe('Date Util', () => {
  const VALID_RAW_DATE = '2026-02-14T12:00:00';
  const INVALID_RAW_DATE = '2026-02-14T25:00:00';
  const DATE_STR = '02/14/2026';
  const DATE = new Date(VALID_RAW_DATE);
  const INVALID_DATE_MSG = '—';

  describe('formatDateBr()', () => {
    it('formata uma entrada de data em texto bruto para a localidade pt-br', () => {
      expect(formatDateBr(VALID_RAW_DATE)).toBe('14/02/2026');
    });

    it('formata uma entrada de data para a localidade pt-br', () => {
      expect(formatDateBr(DATE)).toBe('14/02/2026');
    });

    it('retorna um "—" quando a entrada de data e hora em texto bruto é inválida', () => {
      expect(formatDateBr(INVALID_RAW_DATE)).toBe(INVALID_DATE_MSG);
    });

    it('retorna um "—" quando a entrada de um objeto de data e hora é inválida', () => {
      expect(formatDateBr(new Date(INVALID_RAW_DATE))).toBe(INVALID_DATE_MSG);
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
      expect(formatDateTimeBr(INVALID_RAW_DATE)).toBe(INVALID_DATE_MSG);
    });

    it('retorna um "—" quando a entrada de um objeto de data e hora é inválida', () => {
      expect(formatDateTimeBr(new Date(INVALID_RAW_DATE))).toBe(INVALID_DATE_MSG);
    });
  });

  describe('parseDate()', () => {
    it('transforma entrada de texto no formato (dd/mm/yyyy) para uma data', () => {
      const day = 14;
      const month = '02';
      const monthParseInt = parseInt(month, 10) - 1;
      const year = 2025;
      const result = parseDate(`${day}/${month}/${year}`);

      expect(result).toStrictEqual(new Date(year, monthParseInt, day));
      expect(result?.getDate()).toBe(day);
      expect(result?.getMonth()).toBe(monthParseInt);
      expect(result?.getFullYear()).toBe(year);
    });

    it('transforma corretamente entrada de texto referente a um ano bissexto', () => {
      expect(parseDate('29/02/2024')).toBeTruthy();
    });

    it('retorna null quando a data é um texto vazio', () => {
      expect(parseDate('')).toBe(null);
    });

    it('retorna null quando o mês está fora do intervalo válido', () => {
        expect(parseDate(DATE_STR)).toBe(null);
    });

    it('retorna null quando o separador difere de "/"', () => {
      expect(parseDate('14-02-2026')).toBe(null);
    });

    it('retorna null quando o dia não existe em um determinado mês', () => {
      expect(parseDate('32/01/2026')).toBe(null);
    });

    it('retorna null quando o ano possui apenas dois dígitos', () => {
      expect(parseDate('01/01/26')).toBe(null);
    });

    it('retorna null quando o ano não é bissexto', () => {
      expect(parseDate('29/02/2026')).toBe(null);
    });
  });
});
