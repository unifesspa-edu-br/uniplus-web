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
 * Agrupa os dias não úteis nos 12 meses do ano (Janeiro a Dezembro), prontos para exibição
 * em grade civil de 7 colunas. Meses sem registros permanecem visíveis sem marcações (CA01-CA06).
 */
export function agruparPorMes(
  dias: readonly DiaNaoUtilDto[],
  anoAlvo?: number,
): MesCalendarioMensal[] {
  let ano = anoAlvo;

  // Se o ano não for informado explicitamente, extrai do primeiro registro válido
  if (!ano) {
    for (const dia of dias) {
      const parsed = parseIsoDate(dia.data);
      if (parsed) {
        ano = parsed.getUTCFullYear();
        break;
      }
    }
  }

  // Fallback para o ano atual caso a lista de dias seja vazia
  ano = ano ?? new Date().getUTCFullYear();

  const porMes = new Map<string, Map<number, DiaNaoUtilDto[]>>();

  for (const dia of dias) {
    const parsed = parseIsoDate(dia.data);
    if (!parsed) continue;

    const anoDia = parsed.getUTCFullYear();
    if (anoDia !== ano) continue;

    const anoStr = String(anoDia).padStart(4, '0');
    const mesStr = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const chave = `${anoStr}-${mesStr}`;

    const porDiaDoMes = porMes.get(chave) ?? new Map<number, DiaNaoUtilDto[]>();
    porMes.set(chave, porDiaDoMes);

    const diaDoMes = parsed.getUTCDate();
    const ocorrencias = porDiaDoMes.get(diaDoMes) ?? [];
    ocorrencias.push(dia);
    porDiaDoMes.set(diaDoMes, ocorrencias);
  }

  const anoStr = String(ano).padStart(4, '0');
  const resultado: MesCalendarioMensal[] = [];

  // Garante a criação dos 12 meses (Janeiro a Dezembro) em ordem cronológica
  for (let mesIndice = 1; mesIndice <= 12; mesIndice++) {
    const mesStr = String(mesIndice).padStart(2, '0');
    const chave = `${anoStr}-${mesStr}`;
    const porDiaDoMes = porMes.get(chave) ?? new Map<number, DiaNaoUtilDto[]>();
    resultado.push(construirMes(chave, porDiaDoMes));
  }

  return resultado;
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
