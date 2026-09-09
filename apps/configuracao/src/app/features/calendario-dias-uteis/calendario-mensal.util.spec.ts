import type { DiaNaoUtilDto } from '@uniplus/shared-data/configuracao';
import { describe, expect, it } from 'vitest';
import { agruparPorMes, anosDoCalendario, type CelulaCalendarioMensal } from './calendario-mensal.util';

function diaNaoUtil(
  overrides: Partial<DiaNaoUtilDto> & { id: string; data: string },
): DiaNaoUtilDto {
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
    .filter(
      (celula): celula is CelulaCalendarioMensal =>
        celula !== null && celula.ocorrencias.length > 0,
    );
}

describe('agruparPorMes()', () => {
  it('apresenta todos os 12 meses do ano em ordem cronológica, incluindo meses sem feriado (CA01, CA02, CA03)', () => {
    const dias = [
      diaNaoUtil({ id: '1', data: '2026-12-25', descricao: 'Natal' }),
      diaNaoUtil({ id: '2', data: '2026-01-01', descricao: 'Confraternização' }),
      diaNaoUtil({ id: '3', data: '2026-04-21', descricao: 'Tiradentes' }),
    ];

    const meses = agruparPorMes(dias, 2026);

    expect(meses).toHaveLength(12);
    expect(meses.map((mes) => mes.chave)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
    ]);
    expect(meses.map((mes) => mes.rotulo)).toEqual([
      'Janeiro de 2026',
      'Fevereiro de 2026',
      'Março de 2026',
      'Abril de 2026',
      'Maio de 2026',
      'Junho de 2026',
      'Julho de 2026',
      'Agosto de 2026',
      'Setembro de 2026',
      'Outubro de 2026',
      'Novembro de 2026',
      'Dezembro de 2026',
    ]);
  });

  it('apresenta 12 meses mesmo para dataset sem dias cadastrados (CA04)', () => {
    const meses = agruparPorMes([], 2026);

    expect(meses).toHaveLength(12);
    expect(celulasComOcorrencia(meses)).toHaveLength(0);
  });

  it('respeita o ano selecionado e ignora datas de outros anos (CA06)', () => {
    const dias = [
      diaNaoUtil({ id: '1', data: '2026-01-01', descricao: 'Ano Novo 2026' }),
      diaNaoUtil({ id: '2', data: '2027-01-01', descricao: 'Ano Novo 2027' }),
    ];

    const meses = agruparPorMes(dias, 2026);

    expect(meses).toHaveLength(12);
    expect(meses.every((mes) => mes.ano === 2026)).toBe(true);
    const celulas = celulasComOcorrencia(meses);
    expect(celulas).toHaveLength(1);
    expect(celulas[0].ocorrencias[0].id).toBe('1');
  });

  it('descarta defensivamente datas que não formam um calendário válido', () => {
    const dias = [
      diaNaoUtil({ id: '1', data: '2026-02-30' }),
      diaNaoUtil({ id: '2', data: '2026-04-21', descricao: 'Tiradentes' }),
    ];

    const meses = agruparPorMes(dias, 2026);

    expect(meses).toHaveLength(12);
    const celulas = celulasComOcorrencia(meses);
    expect(celulas).toHaveLength(1);
    expect(celulas[0].data).toBe('2026-04-21');
  });

  describe('posicionamento civil da semana', () => {
    it('fevereiro de 2026 começa no domingo (padding zero)', () => {
      // 2026-02-01 é domingo.
      const meses = agruparPorMes([diaNaoUtil({ id: '1', data: '2026-02-14' })], 2026);
      const fevereiro = meses[1];
      expect(fevereiro.semanas[0][0]).not.toBeNull();
      expect(fevereiro.semanas[0][0]?.dia).toBe(1);
    });

    it('abril de 2026 começa numa quarta-feira (3 paddings)', () => {
      // 2026-04-01 é quarta-feira.
      const meses = agruparPorMes([diaNaoUtil({ id: '1', data: '2026-04-21' })], 2026);
      const abril = meses[3];
      expect(abril.semanas[0].slice(0, 3)).toEqual([null, null, null]);
      expect(abril.semanas[0][3]?.dia).toBe(1);
    });

    it('todo mês tem exatamente 7 colunas em cada semana', () => {
      const meses = agruparPorMes([diaNaoUtil({ id: '1', data: '2026-04-21' })], 2026);
      for (const mes of meses) {
        for (const semana of mes.semanas) {
          expect(semana).toHaveLength(7);
        }
      }
    });

    it('fevereiro de ano bissexto (2028) tem 29 dias mapeados', () => {
      const meses = agruparPorMes(
        [diaNaoUtil({ id: '1', data: '2028-02-29', descricao: 'Bissexto' })],
        2028,
      );
      const fevereiro = meses[1];
      const dias = fevereiro.semanas
        .flat()
        .filter((celula): celula is CelulaCalendarioMensal => celula !== null);
      expect(dias).toHaveLength(29);
      expect(dias.at(-1)?.dia).toBe(29);
      expect(dias.at(-1)?.ocorrencias[0]?.descricao).toBe('Bissexto');
    });
  });

  it('agrega múltiplas ocorrências na mesma data civil numa única célula', () => {
    const dias = [
      diaNaoUtil({
        id: '1',
        data: '2026-11-15',
        abrangencia: 'NACIONAL',
        descricao: 'Proclamação da República',
      }),
      diaNaoUtil({
        id: '2',
        data: '2026-11-15',
        abrangencia: 'INSTITUCIONAL',
        descricao: 'Aniversário da UFPA',
      }),
    ];

    const meses = agruparPorMes(dias, 2026);
    const celulas = celulasComOcorrencia(meses);

    expect(celulas).toHaveLength(1);
    expect(celulas[0].ocorrencias.map((o) => o.id)).toEqual(['1', '2']);
  });

  it('dias sem feriado permanecem como célula com ocorrencias vazio (CA04, CA05)', () => {
    const meses = agruparPorMes([diaNaoUtil({ id: '1', data: '2026-04-21' })], 2026);
    const abril = meses[3];
    const dia1 = abril.semanas.flat().find((celula) => celula?.dia === 1);
    expect(dia1?.ocorrencias).toEqual([]);
    expect(dia1?.data).toBe('2026-04-01');
  });
});

describe('anosDoCalendario()', () => {
  it('retorna os anos presentes no dataset em ordem crescente, sem repetição', () => {
    const dias = [
      diaNaoUtil({ id: '1', data: '2026-11-15', descricao: 'Proclamação da República' }),
      diaNaoUtil({ id: '2', data: '2027-01-01', descricao: 'Confraternização Universal' }),
      diaNaoUtil({ id: '3', data: '2026-12-25', descricao: 'Natal' }),
    ];

    expect(anosDoCalendario(dias)).toEqual([2026, 2027]);
  });

  it('retorna um único ano quando o dataset não atravessa a virada do ano', () => {
    const dias = [diaNaoUtil({ id: '1', data: '2026-04-21', descricao: 'Tiradentes' })];

    expect(anosDoCalendario(dias)).toEqual([2026]);
  });

  it('cai no ano corrente quando o dataset está vazio ou só tem datas inválidas', () => {
    expect(anosDoCalendario([])).toEqual([new Date().getUTCFullYear()]);
    expect(anosDoCalendario([diaNaoUtil({ id: '1', data: '2026-02-30' })])).toEqual([
      new Date().getUTCFullYear(),
    ]);
  });
});
