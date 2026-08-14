import { afterEach, describe, expect, it } from 'vitest';
import {
  formatDateBr,
  formatDateTimeBr,
  formatIsoDateBr,
  formatIsoDateLong,
  parseDate,
  parseIsoDate,
} from './date.util';

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

      it('compõe com formatDateBr preservando o dia civil no fuso local (contrato estabelecido)', () => {
        const date = parseDate('14/02/2025');
        expect(date).not.toBeNull();
        expect(formatDateBr(date as Date)).toBe('14/02/2025');
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

  describe('parseIsoDate()', () => {
    describe('entradas válidas', () => {
      it.each([
        { input: '2025-02-14', expected: new Date(Date.UTC(2025, 1, 14)), descricao: 'data comum' },
        { input: '2026-01-01', expected: new Date(Date.UTC(2026, 0, 1)), descricao: 'primeiro do ano' },
        { input: '2026-12-31', expected: new Date(Date.UTC(2026, 11, 31)), descricao: 'último do ano' },
        { input: '2028-02-29', expected: new Date(Date.UTC(2028, 1, 29)), descricao: 'ano bissexto' },
        {
          input: '2000-02-29',
          expected: new Date(Date.UTC(2000, 1, 29)),
          descricao: 'ano secular bissexto (múltiplo de 400)',
        },
      ])('parseia "$input" — $descricao', ({ input, expected }) => {
        expect(parseIsoDate(input)).toEqual(expected);
      });

      it('tolera espaços nas bordas', () => {
        expect(parseIsoDate('  2025-02-14  ')).toEqual(new Date(Date.UTC(2025, 1, 14)));
      });

      it('não limita por intervalo de ano — quem valida isso é a API na criação', () => {
        expect(parseIsoDate('1899-01-01')).toEqual(new Date(Date.UTC(1899, 0, 1)));
        expect(parseIsoDate('2101-01-01')).toEqual(new Date(Date.UTC(2101, 0, 1)));
      });

      it('preserva ano de 1 a 3 dígitos sem o remapeamento legado de Date.UTC para 1900-1999', () => {
        // Date.UTC(1, 5, 15) retornaria ano 1901, não 1 — exatamente o bug
        // que motiva parseIsoDate usar setUTCFullYear em vez de Date.UTC.
        const anoUm = parseIsoDate('0001-06-15');
        expect(anoUm?.getUTCFullYear()).toBe(1);
        expect(anoUm?.getUTCMonth()).toBe(5);
        expect(anoUm?.getUTCDate()).toBe(15);

        expect(parseIsoDate('0099-12-31')?.getUTCFullYear()).toBe(99);
        expect(formatIsoDateLong('0001-06-15')).toBe('15 de junho de 1');
      });

      it('componentes UTC lidos de volta batem com a entrada, em qualquer fuso do host', () => {
        const date = parseIsoDate('2026-04-05');
        expect(date?.getUTCFullYear()).toBe(2026);
        expect(date?.getUTCMonth()).toBe(3);
        expect(date?.getUTCDate()).toBe(5);
      });
    });

    describe('entradas inválidas (retorna null)', () => {
      it.each([
        { input: '', descricao: 'string vazia' },
        { input: '   ', descricao: 'apenas espaços' },
        { input: '2026/02/14', descricao: 'separador diferente de "-"' },
        { input: '14-02-2026', descricao: 'ordem dd-mm-yyyy em vez de yyyy-mm-dd' },
        { input: '2026-02-14T00:00:00', descricao: 'com componente de hora' },
        { input: '2026-14-02', descricao: 'mês 14 fora do intervalo' },
        { input: '2026-00-01', descricao: 'mês 0 fora do intervalo' },
        { input: '2026-13-01', descricao: 'mês 13 fora do intervalo' },
        { input: '2026-01-32', descricao: 'dia 32 fora do intervalo' },
        { input: '2026-01-00', descricao: 'dia 0 fora do intervalo' },
        { input: '26-01-01', descricao: 'ano com 2 dígitos' },
        { input: 'cccc-bb-aa', descricao: 'caracteres não-numéricos' },
        { input: '2026-02-30', descricao: '30 de fevereiro nunca existe' },
        { input: '2026-04-31', descricao: '31 de abril nunca existe' },
        { input: '2026-02-29', descricao: '29/02 em ano não bissexto' },
        { input: '1900-02-29', descricao: '29/02 em ano secular não bissexto (não múltiplo de 400)' },
      ])('retorna null para "$input" — $descricao', ({ input }) => {
        expect(parseIsoDate(input)).toBeNull();
      });
    });

    describe('validação independe do fuso do processo', () => {
      const TZ_ORIGINAL = process.env['TZ'];

      afterEach(() => {
        if (TZ_ORIGINAL === undefined) delete process.env['TZ'];
        else process.env['TZ'] = TZ_ORIGINAL;
      });

      it('preserva o dia civil exato de 2011-12-30 sob TZ=Pacific/Apia, não só retorna não-nulo', () => {
        process.env['TZ'] = 'Pacific/Apia';
        const date = parseIsoDate('2011-12-30');
        // Construção/leitura por componentes locais normalizaria para 31 —
        // é exatamente o que este teste garante que não acontece mais.
        expect(date?.getUTCFullYear()).toBe(2011);
        expect(date?.getUTCMonth()).toBe(11);
        expect(date?.getUTCDate()).toBe(30);
        expect(formatIsoDateBr('2011-12-30')).toBe('30/12/2011');
      });
    });
  });

  describe('formatIsoDateBr()', () => {
    it('formata uma data date-only para dd/MM/aaaa', () => {
      expect(formatIsoDateBr('2026-04-05')).toBe('05/04/2026');
    });

    it('retorna "—" para entrada inválida', () => {
      expect(formatIsoDateBr('2026-02-30')).toBe(PLACEHOLDER_DATA_INVALIDA);
    });
  });

  describe('formatIsoDateLong()', () => {
    it('formata por extenso sem zero à esquerda no dia', () => {
      expect(formatIsoDateLong('2026-04-05')).toBe('5 de abril de 2026');
    });

    it('formata o exemplo canônico da issue #525', () => {
      expect(formatIsoDateLong('2027-12-25')).toBe('25 de dezembro de 2027');
    });

    it('retorna "—" para entrada inválida', () => {
      expect(formatIsoDateLong('2026-04-31')).toBe(PLACEHOLDER_DATA_INVALIDA);
    });
  });
});
