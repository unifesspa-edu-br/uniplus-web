const DATE_FORMAT_REGEX = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

export function formatDateBr(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

export function formatDateTimeBr(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR');
}

/**
 * Parse uma string no formato `dd/mm/yyyy` para `Date`.
 *
 * Tolera espaços nas bordas. Aceita dia/mês com 1 ou 2 dígitos. Retorna
 * `null` para entradas que:
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

  const date = new Date(year, month - 1, day);
  return isExactCalendarDate(date, day, month, year) ? date : null;
}

function isExactCalendarDate(date: Date, day: number, month: number, year: number): boolean {
  return (
    date.getDate() === day &&
    date.getMonth() === month - 1 &&
    date.getFullYear() === year
  );
}
