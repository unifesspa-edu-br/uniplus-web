/**
 * Fuso em que o dia civil do certame começa e termina, e em que todo prazo do processo é contado
 * (UNI-REQ-0111). É o fuso que a API congela na publicação; não é preferência de exibição.
 */
export const FUSO_INSTITUCIONAL = 'America/Belem';

export type FormatoDataBr = 'short' | 'long' | 'datetime' | 'datetimeSeconds' | 'shortMonth';
export type EntradaDataBr = Date | string | null | undefined;

/** A hora de parede num fuso: o que um campo de data e hora entrega, sem deslocamento. */
export interface HoraDeParede {
  readonly ano: number;
  readonly mes: number;
  readonly dia: number;
  readonly hora: number;
  readonly minuto: number;
  readonly segundo: number;
}

/** Data-hora com designador de zona explícito (`Z` ou `±hh:mm`). */
const DATA_HORA_COM_ZONA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const DATA_HORA_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;
const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATA_BR_COM_HIFEN = /^(\d{2})-(\d{2})-(\d{4})$/;

const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MS_POR_DIA = 24 * 60 * 60 * 1_000;

const DATA: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
const HORA: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };

const OPCOES_POR_FORMATO: Record<FormatoDataBr, Intl.DateTimeFormatOptions> = {
  short: DATA,
  shortMonth: { day: '2-digit', month: 'short', year: 'numeric' },
  long: { day: '2-digit', month: 'long', year: 'numeric' },
  datetime: { ...DATA, ...HORA },
  datetimeSeconds: { ...DATA, ...HORA, second: '2-digit' },
};

/**
 * Construir um `Intl.DateTimeFormat` custa mais do que formatar, e as telas formatam a cada
 * detecção de mudanças: um formatador por formato e fuso, criado na primeira vez.
 */
const formatadores = new Map<string, Intl.DateTimeFormat>();

function formatador(
  locale: string,
  opcoes: Intl.DateTimeFormatOptions,
  fuso: string,
  chave: string,
): Intl.DateTimeFormat {
  const existente = formatadores.get(chave);
  if (existente) return existente;
  const novo = new Intl.DateTimeFormat(locale, { ...opcoes, timeZone: fuso });
  formatadores.set(chave, novo);
  return novo;
}

/**
 * Data ou instante como as telas do Uni+ o mostram, em pt-BR e no fuso dado — por padrão, o
 * institucional. A hora de parede sem zona (`AAAA-MM-DDTHH:mm`) é lida nesse mesmo fuso, para que
 * a hora exibida seja a escrita. A data pura (`AAAA-MM-DD`, `DD-MM-AAAA`) não tem fuso: é
 * formatada como data de calendário, sem passar por instante. Entrada vazia ou inválida vira texto
 * vazio.
 */
export function formatarDataBr(
  entrada: EntradaDataBr,
  formato: FormatoDataBr = 'short',
  fuso: string = FUSO_INSTITUCIONAL,
): string {
  if (!entrada) return '';
  const lida = entrada instanceof Date ? { instante: entrada, fuso } : lerEntrada(entrada, fuso);
  if (!lida || Number.isNaN(lida.instante.getTime())) return '';
  const intl = formatador(
    'pt-BR',
    OPCOES_POR_FORMATO[formato],
    lida.fuso,
    `${formato}|${lida.fuso}`,
  );
  if (formato !== 'shortMonth') return intl.format(lida.instante);
  // O Intl abrevia o mês com ponto ("jun."); a tela mostra "05 jun 2026".
  const partes = new Map(intl.formatToParts(lida.instante).map((p) => [p.type, p.value]));
  return `${partes.get('day') ?? ''} ${(partes.get('month') ?? '').replace('.', '')} ${partes.get('year') ?? ''}`;
}

/**
 * Data de calendário `AAAA-MM-DD`, sem hora nem fuso, ancorada à meia-noite UTC e lida só por
 * `getUTC*`: UTC nunca pula dia civil, e um fuso que começou o horário de verão à meia-noite
 * (Belém em 25/10/1987) faria a data cair no dia anterior. Data inexistente vira `null`.
 */
export function lerDataIso(texto: string): Date | null {
  const partes = DATA_ISO.exec(texto.trim());
  if (!partes) return null;
  const [ano, mes, dia] = partes.slice(1, 4).map(Number);
  return dataPura(ano, mes, dia);
}

/**
 * Valida ano, mês e dia por aritmética de calendário gregoriano, sem construir `Date`: um
 * round-trip por `new Date(...)` com getters locais rejeitaria uma data real nos fusos que
 * suprimem um dia civil numa transição (`Pacific/Apia` pulou 30/12/2011), conforme o fuso de
 * quem executa.
 */
export function dataGregorianaValida(ano: number, mes: number, dia: number): boolean {
  if (mes < 1 || mes > 12) return false;
  const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
  const diasNoMes = mes === 2 && bissexto ? 29 : DIAS_POR_MES[mes - 1];
  return dia >= 1 && dia <= diasNoMes;
}

/**
 * O instante que uma hora de parede representa no fuso dado. O deslocamento é perguntado ao
 * `Intl` para a própria data, em vez de fixado em `-03:00`, que acertaria hoje e passaria a
 * mentir se a regra do fuso mudasse.
 *
 * Perto de uma virada de horário de verão, a hora de parede pode não existir (a lacuna, quando o
 * relógio salta) ou existir duas vezes (a sobreposição, quando volta). A resolução é a
 * "compatível" de Temporal e de java.time: na lacuna, avança para o instante seguinte; na
 * sobreposição, fica com o mais cedo.
 */
export function instanteDaHoraDeParede(
  horaDeParede: HoraDeParede,
  fuso: string = FUSO_INSTITUCIONAL,
): Date {
  const { ano, mes, dia, hora, minuto, segundo } = horaDeParede;
  const comoSeFosseUtc = new Date(0);
  comoSeFosseUtc.setUTCFullYear(ano, mes - 1, dia);
  comoSeFosseUtc.setUTCHours(hora, minuto, segundo, 0);
  const utc = comoSeFosseUtc.getTime();
  // Os deslocamentos de antes e de depois de uma eventual virada: um dia de folga basta, porque
  // nenhum fuso muda de regra duas vezes em dois dias.
  const antes = deslocamentoEmMilissegundos(new Date(utc - MS_POR_DIA), fuso);
  const depois = deslocamentoEmMilissegundos(new Date(utc + MS_POR_DIA), fuso);
  const candidatos = [utc - antes, utc - depois]
    .sort((a, b) => a - b)
    .filter((instante) => mesmaHoraDeParede(new Date(instante), horaDeParede, fuso));
  // Sem candidato, a hora cai na lacuna: lida com o deslocamento de antes da virada, ela avança
  // tanto quanto o relógio saltou.
  return new Date(candidatos[0] ?? utc - antes);
}

/** Deslocamento do fuso em relação a UTC, em minutos, no instante dado (Belém hoje: −180). */
export function deslocamentoDoFusoEmMinutos(
  instante: Date,
  fuso: string = FUSO_INSTITUCIONAL,
): number {
  return Math.round(deslocamentoEmMilissegundos(instante, fuso) / 60_000);
}

/**
 * Em milissegundos, para não arredondar os deslocamentos históricos que não são de minutos
 * inteiros (a hora média local de Belém, antes de 1914, era −3:13:56).
 */
function deslocamentoEmMilissegundos(instante: Date, fuso: string): number {
  const partes = partesNoFuso(instante, fuso);
  const comoSeFosseUtc = new Date(0);
  comoSeFosseUtc.setUTCFullYear(Number(partes.ano), Number(partes.mes) - 1, Number(partes.dia));
  comoSeFosseUtc.setUTCHours(Number(partes.hora), Number(partes.minuto), Number(partes.segundo), 0);
  // O instante pode trazer milissegundos; a hora de parede, não.
  const semMilissegundos = Math.floor(instante.getTime() / 1_000) * 1_000;
  return comoSeFosseUtc.getTime() - semMilissegundos;
}

/** As partes da hora de parede de um instante no fuso dado, com dois dígitos (ano com quatro). */
export interface PartesDoInstante {
  readonly ano: string;
  readonly mes: string;
  readonly dia: string;
  readonly hora: string;
  readonly minuto: string;
  readonly segundo: string;
}

export function partesNoFuso(instante: Date, fuso: string = FUSO_INSTITUCIONAL): PartesDoInstante {
  const intl = formatador(
    'en-CA',
    {
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    },
    fuso,
    `partes|${fuso}`,
  );
  const encontradas = new Map(intl.formatToParts(instante).map((p) => [p.type, p.value]));
  const hora = encontradas.get('hour') ?? '00';
  return {
    ano: (encontradas.get('year') ?? '0').padStart(4, '0'),
    mes: encontradas.get('month') ?? '01',
    dia: encontradas.get('day') ?? '01',
    // `hour12: false` produz 24 para a meia-noite em alguns motores.
    hora: hora === '24' ? '00' : hora,
    minuto: encontradas.get('minute') ?? '00',
    segundo: encontradas.get('second') ?? '00',
  };
}

function mesmaHoraDeParede(instante: Date, esperada: HoraDeParede, fuso: string): boolean {
  const partes = partesNoFuso(instante, fuso);
  return (
    Number(partes.ano) === esperada.ano &&
    Number(partes.mes) === esperada.mes &&
    Number(partes.dia) === esperada.dia &&
    Number(partes.hora) === esperada.hora &&
    Number(partes.minuto) === esperada.minuto &&
    Number(partes.segundo) === esperada.segundo
  );
}

/** O instante a formatar e o fuso em que formatá-lo; a data pura se formata em UTC. */
interface EntradaLida {
  readonly instante: Date;
  readonly fuso: string;
}

function lerEntrada(texto: string, fuso: string): EntradaLida | null {
  if (DATA_HORA_COM_ZONA.test(texto)) {
    const instante = new Date(texto);
    return Number.isNaN(instante.getTime()) ? null : { instante, fuso };
  }
  const local = DATA_HORA_LOCAL.exec(texto);
  if (local) {
    const [ano, mes, dia, hora, minuto] = local.slice(1, 6).map(Number);
    const segundo = Number(local[6] ?? 0);
    return dataGregorianaValida(ano, mes, dia) && horaValida(hora, minuto, segundo)
      ? { instante: instanteDaHoraDeParede({ ano, mes, dia, hora, minuto, segundo }, fuso), fuso }
      : null;
  }
  const br = DATA_BR_COM_HIFEN.exec(texto);
  const data = br ? dataPura(Number(br[3]), Number(br[2]), Number(br[1])) : lerDataIso(texto);
  return data ? { instante: data, fuso: 'UTC' } : null;
}

function dataPura(ano: number, mes: number, dia: number): Date | null {
  if (!dataGregorianaValida(ano, mes, dia)) return null;
  const data = new Date(0);
  data.setUTCFullYear(ano, mes - 1, dia);
  return data;
}

function horaValida(hora: number, minuto: number, segundo: number): boolean {
  return hora >= 0 && hora <= 23 && minuto >= 0 && minuto <= 59 && segundo >= 0 && segundo <= 59;
}
