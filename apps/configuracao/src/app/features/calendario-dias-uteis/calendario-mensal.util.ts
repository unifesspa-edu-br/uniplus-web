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
 * Monta os 12 meses (Janeiro a Dezembro) de um único ano, prontos para exibição em grade
 * civil de 7 colunas. Meses sem registros permanecem visíveis sem marcações (CA01-CA05).
 * Dias não úteis de outros anos são ignorados — quem decide quais anos mostrar é o
 * chamador, via {@link anosDoCalendario}, não esta função.
 */
export function agruparPorMes(dias: readonly DiaNaoUtilDto[], ano: number): MesCalendarioMensal[] {
  const porMes = agruparPorAnoMes(dias, ano);

  const resultado: MesCalendarioMensal[] = [];
  for (let mesIndice = 1; mesIndice <= 12; mesIndice++) {
    const chave = chaveAnoMes(ano, mesIndice);
    resultado.push(construirMes(chave, porMes.get(chave) ?? new Map()));
  }

  return resultado;
}

/**
 * Anos com ao menos um dia não útil no dataset, em ordem crescente. A tela ainda não
 * tem seletor de ano (issue #712): até que exista, todo ano presente no dataset precisa
 * ser exibido, para não fazer feriados cadastrados sumirem da visualização quando o
 * dataset atravessa a virada do ano (issue #525, CA05). Dataset vazio cai no ano
 * corrente, só para não devolver uma tela sem nenhum mês.
 */
export function anosDoCalendario(dias: readonly DiaNaoUtilDto[]): number[] {
  const anos = new Set<number>();

  for (const dia of dias) {
    const parsed = parseIsoDate(dia.data);
    if (parsed) anos.add(parsed.getUTCFullYear());
  }

  if (anos.size === 0) anos.add(new Date().getUTCFullYear());

  return [...anos].sort((a, b) => a - b);
}

function chaveAnoMes(ano: number, mes: number): string {
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}`;
}

function agruparPorAnoMes(
  dias: readonly DiaNaoUtilDto[],
  ano: number,
): Map<string, Map<number, DiaNaoUtilDto[]>> {
  const porMes = new Map<string, Map<number, DiaNaoUtilDto[]>>();

  for (const dia of dias) {
    const parsed = parseIsoDate(dia.data);
    if (!parsed || parsed.getUTCFullYear() !== ano) continue;

    const chave = chaveAnoMes(ano, parsed.getUTCMonth() + 1);
    const porDiaDoMes = porMes.get(chave) ?? new Map<number, DiaNaoUtilDto[]>();
    porMes.set(chave, porDiaDoMes);

    const diaDoMes = parsed.getUTCDate();
    const ocorrencias = porDiaDoMes.get(diaDoMes) ?? [];
    ocorrencias.push(dia);
    porDiaDoMes.set(diaDoMes, ocorrencias);
  }

  return porMes;
}

function construirMes(
  chave: string,
  porDiaDoMes: Map<number, DiaNaoUtilDto[]>,
): MesCalendarioMensal {
  const [anoStr, mesStr] = chave.split('-');
  const ano = Number(anoStr);
  const mes = Number(mesStr);

  const primeiroDia = new Date(0);
  primeiroDia.setUTCFullYear(ano, mes - 1, 1);
  const primeiroDiaSemana = primeiroDia.getUTCDay();

  const ultimoDiaDoMes = new Date(0);
  ultimoDiaDoMes.setUTCFullYear(ano, mes, 0);
  const totalDias = ultimoDiaDoMes.getUTCDate();

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
