import type { DiaNaoUtilDto } from '@uniplus/shared-data/configuracao';
import { formatIsoDateLong } from '@uniplus/shared-data/utils';
import { describe, expect, it } from 'vitest';
import {
  agruparPorMes,
  contarDiasNaoUteisUnicos,
  type CelulaCalendarioMensal,
} from './calendario-mensal.util';

function diaNaoUtil(overrides: Partial<DiaNaoUtilDto> & { id: string; data: string }): DiaNaoUtilDto {
  return {
    abrangencia: 'NACIONAL',
    municipioIbge: null,
    municipioNome: null,
    municipioUf: null,
    uf: null,
    descricao: 'Feriado de teste',
    ...overrides,
  };
}

function celulasComOcorrencia(meses: ReturnType<typeof agruparPorMes>): CelulaCalendarioMensal[] {
  return meses
    .flatMap((mes) => mes.semanas)
    .flat()
    .filter((celula): celula is CelulaCalendarioMensal => celula !== null && celula.ocorrencias.length > 0);
}

describe('agruparPorMes()', () => {
  it('agrupa cronologicamente e omite meses sem feriado', () => {
    const dias = [
      diaNaoUtil({ id: '1', data: '2026-12-25', descricao: 'Natal' }),
      diaNaoUtil({ id: '2', data: '2026-01-01', descricao: 'Confraternização' }),
      diaNaoUtil({ id: '3', data: '2026-04-21', descricao: 'Tiradentes' }),
    ];

    const meses = agruparPorMes(dias);

    expect(meses.map((mes) => mes.chave)).toEqual(['2026-01', '2026-04', '2026-12']);
    expect(meses.map((mes) => mes.rotulo)).toEqual([
      'Janeiro de 2026',
      'Abril de 2026',
      'Dezembro de 2026',
    ]);
  });

  it('atravessa anos mantendo ordem cronológica', () => {
    const dias = [
      diaNaoUtil({ id: '1', data: '2027-01-01' }),
      diaNaoUtil({ id: '2', data: '2026-12-25' }),
    ];

    const meses = agruparPorMes(dias);

    expect(meses.map((mes) => mes.chave)).toEqual(['2026-12', '2027-01']);
  });

  it('retorna lista vazia para dataset sem dias', () => {
    expect(agruparPorMes([])).toEqual([]);
  });

  it('descarta defensivamente datas que não formam um calendário válido', () => {
    const dias = [
      diaNaoUtil({ id: '1', data: '2026-02-30' }),
      diaNaoUtil({ id: '2', data: '2026-04-21', descricao: 'Tiradentes' }),
    ];

    const meses = agruparPorMes(dias);

    expect(meses).toHaveLength(1);
    expect(meses[0].chave).toBe('2026-04');
  });

  describe('posicionamento civil da semana', () => {
    it('fevereiro de 2026 começa numa domingo (padding zero)', () => {
      // 2026-02-01 é domingo.
      const [mes] = agruparPorMes([diaNaoUtil({ id: '1', data: '2026-02-14' })]);
      expect(mes.semanas[0][0]).not.toBeNull();
      expect(mes.semanas[0][0]?.dia).toBe(1);
    });

    it('abril de 2026 começa numa quarta-feira (3 paddings)', () => {
      // 2026-04-01 é quarta-feira.
      const [mes] = agruparPorMes([diaNaoUtil({ id: '1', data: '2026-04-21' })]);
      expect(mes.semanas[0].slice(0, 3)).toEqual([null, null, null]);
      expect(mes.semanas[0][3]?.dia).toBe(1);
    });

    it('todo mês tem exatamente 7 colunas em cada semana', () => {
      const [mes] = agruparPorMes([diaNaoUtil({ id: '1', data: '2026-04-21' })]);
      for (const semana of mes.semanas) {
        expect(semana).toHaveLength(7);
      }
    });

    it('ano de 1 dígito não é remapeado para 1900+ano (bug legado de Date.UTC)', () => {
      // 0001-06-15 é sexta-feira no calendário proléptico — se o ano 1 fosse
      // remapeado para 1901 (comportamento legado de Date.UTC(ano, …) para
      // ano 0-99), a data cairia num sábado, com 6 paddings em vez de 5.
      const [mes] = agruparPorMes([diaNaoUtil({ id: '1', data: '0001-06-15' })]);
      expect(mes.chave).toBe('0001-06');
      expect(mes.ano).toBe(1);
      expect(mes.semanas[0].slice(0, 5)).toEqual([null, null, null, null, null]);
      expect(mes.semanas[0][5]?.dia).toBe(1);
    });

    it('data da célula com ano < 1000 continua YYYY-MM-DD válido (round-trip por parseIsoDate)', () => {
      // getUTCFullYear() devolve ano sem zeros à esquerda — sem padStart na
      // chave, a data da célula vira "1-06-15" em vez de "0001-06-15", e
      // formatIsoDateLong/formatIsoDateBr (usados no título do drawer e no
      // campo Data) rejeitam esse formato, mostrando "—" mesmo com o
      // feriado corretamente posicionado na grade.
      const [mes] = agruparPorMes([diaNaoUtil({ id: '1', data: '0001-06-15' })]);
      const celulaDoDia15 = mes.semanas.flat().find((celula) => celula?.dia === 15);
      expect(celulaDoDia15?.data).toBe('0001-06-15');
      // O mesmo valor que o drawer usaria para o título — precisa formatar,
      // não cair no placeholder "—" de entrada inválida.
      expect(formatIsoDateLong(celulaDoDia15?.data ?? '')).toBe('15 de junho de 1');
    });

    it('fevereiro de ano bissexto (2028) tem 29 dias mapeados', () => {
      const [mes] = agruparPorMes([diaNaoUtil({ id: '1', data: '2028-02-29', descricao: 'Bissexto' })]);
      const dias = mes.semanas.flat().filter((celula): celula is CelulaCalendarioMensal => celula !== null);
      expect(dias).toHaveLength(29);
      expect(dias.at(-1)?.dia).toBe(29);
      expect(dias.at(-1)?.ocorrencias[0]?.descricao).toBe('Bissexto');
    });
  });

  it('agrega múltiplas ocorrências na mesma data civil numa única célula', () => {
    const dias = [
      diaNaoUtil({ id: '1', data: '2026-11-15', abrangencia: 'NACIONAL', descricao: 'Proclamação da República' }),
      diaNaoUtil({ id: '2', data: '2026-11-15', abrangencia: 'INSTITUCIONAL', descricao: 'Aniversário da UFPA' }),
    ];

    const meses = agruparPorMes(dias);
    const celulas = celulasComOcorrencia(meses);

    expect(celulas).toHaveLength(1);
    expect(celulas[0].ocorrencias.map((o) => o.id)).toEqual(['1', '2']);
  });

  it('dias sem feriado permanecem como célula com ocorrencias vazio', () => {
    const [mes] = agruparPorMes([diaNaoUtil({ id: '1', data: '2026-04-21' })]);
    const dia1 = mes.semanas.flat().find((celula) => celula?.dia === 1);
    expect(dia1?.ocorrencias).toEqual([]);
    expect(dia1?.data).toBe('2026-04-01');
  });
});

describe('contarDiasNaoUteisUnicos()', () => {
  it('conta datas civis únicas, não ocorrências', () => {
    const dias = [
      diaNaoUtil({ id: '1', data: '2026-11-15' }),
      diaNaoUtil({ id: '2', data: '2026-11-15' }),
      diaNaoUtil({ id: '3', data: '2026-12-25' }),
    ];

    expect(contarDiasNaoUteisUnicos(agruparPorMes(dias))).toBe(2);
  });

  it('retorna zero para dataset vazio', () => {
    expect(contarDiasNaoUteisUnicos(agruparPorMes([]))).toBe(0);
  });
});
