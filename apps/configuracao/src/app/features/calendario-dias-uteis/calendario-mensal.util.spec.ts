import type { DiaNaoUtilDto } from '@uniplus/shared-data/configuracao';
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
