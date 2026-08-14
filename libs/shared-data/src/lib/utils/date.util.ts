const DATE_FORMAT_REGEX = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const ISO_DATE_FORMAT_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
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

export function formatDateBr(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

export function formatDateTimeBr(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR');
}

/**
 * Parse uma string no formato `dd/mm/yyyy` para `Date` local.
 *
 * Tolera espaços nas bordas. Aceita dia/mês com 1 ou 2 dígitos. Constrói a
 * data com componentes locais (`new Date(ano, mes - 1, dia)`) — de propósito
 * **diferente** de `parseIsoDate`: `formatDateBr`/`formatDateTimeBr`, os
 * formatadores já estabelecidos deste módulo, leem com métodos locais
 * (`toLocaleDateString('pt-BR')`, sem `timeZone: 'UTC'`), então ancorar
 * `parseDate` em UTC quebraria a composição `formatDateBr(parseDate(...))`
 * para qualquer consumidor futuro — a data voltaria um dia em fusos
 * negativos (ex.: America/Sao_Paulo). A troca é aceita conscientemente:
 * `parseDate` mantém o mesmo risco teórico de normalização que
 * `isValidGregorianDate` não cobre sozinho (fusos que suprimem um dia civil
 * numa transição de offset, ex.: `Pacific/Apia` sobre 30/12/2011) — extremo
 * o bastante para não existir no Brasil, e secundário a preservar o
 * contrato local já testado. Retorna `null` para entradas que:
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
  if (!isValidGregorianDate(year, month, day)) return null;

  return new Date(year, month - 1, day);
}

const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isBissexto(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Valida ano/mês/dia por aritmética pura de calendário gregoriano — sem
 * construir nem ler `Date`. Um round-trip via `new Date(...)` mais getters
 * locais (a abordagem anterior) falha em fusos que suprimem um dia civil
 * numa transição de offset (ex.: `Pacific/Apia` pulou 2011-12-30 ao cruzar
 * a linha internacional de data): a validação rejeitaria uma data
 * gregoriana real dependendo do fuso do processo que a executa.
 */
function isValidGregorianDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) return false;
  const diasNoMes = month === 2 && isBissexto(year) ? 29 : DIAS_POR_MES[month - 1];
  return day >= 1 && day <= diasNoMes;
}

/**
 * Parse uma string `YYYY-MM-DD` (date-only, sem hora/fuso) para `Date`.
 *
 * Constrói a data com `Date.UTC(ano, mes - 1, dia)`, nunca `new Date(string)`
 * nem componentes locais. A validação por aritmética já garante que
 * ano/mês/dia formam um calendário gregoriano real, mas o `Date` retornado
 * ainda precisaria ser lido com getters locais em algum ponto — e alguns
 * fusos *suprimem* um dia civil numa transição de offset (ex.: `Pacific/Apia`
 * pulou 2011-12-30 ao cruzar a linha internacional de data): construir com
 * componentes locais nesse fuso normalizaria silenciosamente a data validada
 * para outro dia. UTC nunca pula dia civil, então é a única linha do tempo
 * segura para representar essa data já validada — quem consome o retorno
 * deve ler com métodos `getUTC*`/`toLocaleDateString(..., { timeZone: 'UTC' })`,
 * nunca os locais. Retorna `null` para entradas malformadas ou que
 * representem data de calendário inexistente (ex.: 2026-02-30, 2026-04-31,
 * 2026-02-29 em ano não bissexto).
 *
 * Sem o corte de ano [1900, 2100] de `parseDate`, de propósito: esta função
 * lê valor já persistido pela API para exibição, não texto livre digitado
 * por usuário. A validação de intervalo de ano de um "dia não útil" é regra
 * de negócio e vive no backend (`CriarCalendarioDiasUteisCommandValidator`);
 * repeti-la aqui descartaria silenciosamente dado real que a API já aceitou,
 * em vez de refletir o que ela de fato retorna.
 */
export function parseIsoDate(dateStr: string): Date | null {
  const match = ISO_DATE_FORMAT_REGEX.exec(dateStr.trim());
  if (!match) return null;

  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr); // 1-based no input
  const day = Number(dayStr);

  if (!isValidGregorianDate(year, month, day)) return null;

  return new Date(Date.UTC(year, month - 1, day));
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
