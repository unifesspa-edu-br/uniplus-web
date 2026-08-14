import { parseIsoDate } from '@uniplus/shared-data/utils';
import type { DiaNaoUtilDto } from '@uniplus/shared-data/configuracao';

/**
 * Uma célula de dia do calendário mensal. `ocorrencias` vazio representa um
 * dia civil sem feriado (renderizado como texto neutro); mais de um item
 * representa múltiplos dias não úteis na mesma data (CA-09).
 */
export interface CelulaCalendarioMensal {
  readonly data: string; // YYYY-MM-DD
  readonly dia: number; // 1-31, número civil do dia
  readonly ocorrencias: readonly DiaNaoUtilDto[];
}

/** Um mês do calendário, em semanas de 7 colunas (domingo a sábado). Células `null` são padding civil. */
export interface MesCalendarioMensal {
  readonly chave: string; // "2026-04" — ordenável lexicograficamente
  readonly ano: number;
  readonly mes: number; // 1-12
  readonly rotulo: string; // "Abril de 2026"
  readonly semanas: readonly (CelulaCalendarioMensal | null)[][];
}

const NOMES_MES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

/**
 * Agrupa os dias não úteis em meses cronológicos, prontos para exibição em
 * grade civil de 7 colunas. Meses sem nenhum dia não útil não aparecem no
 * resultado. Múltiplas ocorrências na mesma data civil viram uma única
 * célula (CA-09). Datas que não parseiam como calendário válido são
 * descartadas — o contrato da API garante `format: date`; este é um
 * descarte defensivo contra dado corrompido, não um caminho esperado.
 */
export function agruparPorMes(dias: readonly DiaNaoUtilDto[]): MesCalendarioMensal[] {
  const porMes = new Map<string, Map<number, DiaNaoUtilDto[]>>();

  for (const dia of dias) {
    const parsed = parseIsoDate(dia.data);
    if (!parsed) continue;

    const chave = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
    const porDiaDoMes = porMes.get(chave) ?? new Map<number, DiaNaoUtilDto[]>();
    porMes.set(chave, porDiaDoMes);

    const diaDoMes = parsed.getDate();
    const ocorrencias = porDiaDoMes.get(diaDoMes) ?? [];
    ocorrencias.push(dia);
    porDiaDoMes.set(diaDoMes, ocorrencias);
  }

  return [...porMes.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([chave, porDiaDoMes]) => construirMes(chave, porDiaDoMes));
}

function construirMes(chave: string, porDiaDoMes: Map<number, DiaNaoUtilDto[]>): MesCalendarioMensal {
  const [anoStr, mesStr] = chave.split('-');
  const ano = Number(anoStr);
  const mes = Number(mesStr);

  const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay(); // 0=dom..6=sáb
  const totalDias = new Date(ano, mes, 0).getDate();

  const celulas: (CelulaCalendarioMensal | null)[] = [
    ...Array.from({ length: primeiroDiaSemana }, () => null),
    ...Array.from({ length: totalDias }, (_, indice) => {
      const dia = indice + 1;
      return {
        dia,
        data: `${anoStr}-${mesStr}-${String(dia).padStart(2, '0')}`,
        ocorrencias: porDiaDoMes.get(dia) ?? [],
      };
    }),
  ];

  const totalCelulas = Math.ceil(celulas.length / 7) * 7;
  while (celulas.length < totalCelulas) celulas.push(null);

  const semanas: (CelulaCalendarioMensal | null)[][] = [];
  for (let inicio = 0; inicio < celulas.length; inicio += 7) {
    semanas.push(celulas.slice(inicio, inicio + 7));
  }

  return { chave, ano, mes, rotulo: `${NOMES_MES[mes - 1]} de ${ano}`, semanas };
}

/** Conta datas civis únicas com pelo menos um dia não útil — não a quantidade de ocorrências (CA-02). */
export function contarDiasNaoUteisUnicos(meses: readonly MesCalendarioMensal[]): number {
  return meses
    .flatMap((mes) => mes.semanas)
    .flat()
    .filter((celula): celula is CelulaCalendarioMensal => celula !== null && celula.ocorrencias.length > 0)
    .length;
}
