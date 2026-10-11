import { dataGregorianaValida, lerDataIso } from '@uniplus/shared-utils';

const DATE_FORMAT_REGEX = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
const MESES_POR_EXTENSO = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

/**
 * Parse uma string no formato `dd/mm/yyyy` para `Date` local.
 *
 * Tolera espaços nas bordas. Aceita dia/mês com 1 ou 2 dígitos. Constrói a
 * data com componentes locais (`new Date(ano, mes - 1, dia)`), diferente de
 * `parseIsoDate`, que ancora em UTC. Retorna `null` para entradas que:
 * - não casem com o formato esperado (separador, dígitos, ano com 4 dígitos);
 * - tenham ano fora do intervalo permitido pelo domínio Uni+ ([1900, 2100]);
 * - representem data de calendário inexistente (ex.: 30/02, 31/04, 29/02
 *   em ano não bissexto).
 */
export function parseDate(dateStr: string): Date | null {
  const match = DATE_FORMAT_REGEX.exec(dateStr.trim());
  if (!match) return null;

  const [, dayStr, monthStr, yearStr] = match;
  const day = Number(dayStr);
  const month = Number(monthStr); // 1-based no input
  const year = Number(yearStr);

  if (year < MIN_YEAR || year > MAX_YEAR) return null;
  if (!dataGregorianaValida(year, month, day)) return null;

  return new Date(year, month - 1, day);
}

/**
 * Parse uma string `YYYY-MM-DD` (date-only, sem hora/fuso) para `Date` ancorado em UTC, pela
 * regra única de `lerDataIso`. Retorna `null` para entrada malformada ou data inexistente.
 *
 * Sem o corte de ano [1900, 2100] de `parseDate`, de propósito: esta função
 * lê valor já persistido pela API para exibição — validar intervalo de ano
 * na criação é regra de negócio do backend (`CriarCalendarioDiasUteisCommandValidator`).
 */
export function parseIsoDate(dateStr: string): Date | null {
  return lerDataIso(dateStr);
}

/** Formata `YYYY-MM-DD` (date-only) como `dd/MM/aaaa`. Retorna `'—'` para entrada inválida. */
export function formatIsoDateBr(dateStr: string): string {
  const date = parseIsoDate(dateStr);
  return date ? date.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
}

/** Formata `YYYY-MM-DD` (date-only) por extenso, ex.: `5 de abril de 2026`. Retorna `'—'` para entrada inválida. */
export function formatIsoDateLong(dateStr: string): string {
  const date = parseIsoDate(dateStr);
  if (!date) return '—';
  return `${date.getUTCDate()} de ${MESES_POR_EXTENSO[date.getUTCMonth()]} de ${date.getUTCFullYear()}`;
}
