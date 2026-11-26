import { parseIsoDate } from '@uniplus/shared-data/utils';
import type { DiaNaoUtilDto } from '@uniplus/shared-data/configuracao';

/**
 * Uma célula de dia do calendário mensal. `ocorrencias` são os dias não úteis à vista e `ocultas`,
 * os que o recorte da exibição esconde da grade: escondidos, eles continuam cadastrados e valendo.
 * As duas listas vazias representam um dia civil sem feriado.
 */
export interface CelulaCalendarioMensal {
  readonly data: string; // YYYY-MM-DD
  readonly dia: number; // 1-31, número civil do dia
  readonly ocorrencias: readonly DiaNaoUtilDto[];
  readonly ocultas: readonly DiaNaoUtilDto[];
}

/** Diz se o dia não útil fica à vista na grade. */
export type VisibilidadeDoDia = (dia: DiaNaoUtilDto) => boolean;

const TODOS_VISIVEIS: VisibilidadeDoDia = () => true;

/** Os dias não úteis do ano, pela data, e o que decide quais deles ficam à vista. */
interface OcorrenciasDoAno {
  readonly porData: ReadonlyMap<string, readonly DiaNaoUtilDto[]>;
  readonly visivel: VisibilidadeDoDia;
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
 * civil de 7 colunas. Meses sem registros permanecem visíveis sem marcações.
 * Dias não úteis de outros anos são ignorados — quem decide quais anos mostrar é o
 * chamador, via {@link anosDoCalendario}, não esta função.
 */
export function agruparPorMes(
  dias: readonly DiaNaoUtilDto[],
  ano: number,
  visivel: VisibilidadeDoDia = TODOS_VISIVEIS,
): MesCalendarioMensal[] {
  const ocorrencias = { porData: diasPorData(dias, ano), visivel };
  return Array.from({ length: 12 }, (_, indice) => construirMes(ano, indice + 1, ocorrencias));
}

/**
 * Anos com ao menos um dia não útil no dataset, em ordem crescente. A tela ainda não
 * tem seletor de ano: até que exista, todo ano presente no dataset precisa
 * ser exibido, para não fazer feriados cadastrados sumirem da visualização quando o
 * dataset atravessa a virada do ano. Dataset vazio cai no ano
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

function dataDaCelula(ano: number, mes: number, dia: number): string {
  return `${chaveAnoMes(ano, mes)}-${String(dia).padStart(2, '0')}`;
}

function diasPorData(dias: readonly DiaNaoUtilDto[], ano: number): Map<string, DiaNaoUtilDto[]> {
  const porData = new Map<string, DiaNaoUtilDto[]>();
  for (const dia of dias) {
    const parsed = parseIsoDate(dia.data);
    if (!parsed || parsed.getUTCFullYear() !== ano) continue;
    const data = dataDaCelula(ano, parsed.getUTCMonth() + 1, parsed.getUTCDate());
    porData.set(data, [...(porData.get(data) ?? []), dia]);
  }
  return porData;
}

function celulaDoDia(
  ano: number,
  mes: number,
  dia: number,
  ocorrencias: OcorrenciasDoAno,
): CelulaCalendarioMensal {
  const data = dataDaCelula(ano, mes, dia);
  const doDia = ocorrencias.porData.get(data) ?? [];
  return {
    dia,
    data,
    ocorrencias: doDia.filter(ocorrencias.visivel),
    ocultas: doDia.filter((ocorrencia) => !ocorrencias.visivel(ocorrencia)),
  };
}

/** `setUTCFullYear` sobre a época, e não o construtor, porque este trata anos de 0 a 99 como 19xx. */
function diaCivil(ano: number, mes: number, dia: number): Date {
  const data = new Date(0);
  data.setUTCFullYear(ano, mes - 1, dia);
  return data;
}

function celulasDoMes(
  ano: number,
  mes: number,
  ocorrencias: OcorrenciasDoAno,
): (CelulaCalendarioMensal | null)[] {
  const vazia = (): null => null;
  const celulas = [
    ...Array.from({ length: diaCivil(ano, mes, 1).getUTCDay() }, vazia),
    ...Array.from({ length: diaCivil(ano, mes + 1, 0).getUTCDate() }, (_, indice) =>
      celulaDoDia(ano, mes, indice + 1, ocorrencias),
    ),
  ];
  const sobra = Math.ceil(celulas.length / 7) * 7 - celulas.length;
  return [...celulas, ...Array.from({ length: sobra }, vazia)];
}

function emSemanas<T>(celulas: readonly T[]): T[][] {
  return Array.from({ length: celulas.length / 7 }, (_, semana) =>
    celulas.slice(semana * 7, semana * 7 + 7),
  );
}

function construirMes(
  ano: number,
  mes: number,
  ocorrencias: OcorrenciasDoAno,
): MesCalendarioMensal {
  return {
    chave: chaveAnoMes(ano, mes),
    ano,
    mes,
    rotulo: `${NOMES_MES[mes - 1]} de ${ano}`,
    semanas: emSemanas(celulasDoMes(ano, mes, ocorrencias)),
  };
}
