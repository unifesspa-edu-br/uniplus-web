/**
 * Fuso em que o dia civil do certame começa e termina.
 *
 * Não é preferência de exibição: é o fuso que a versão publicada congela e no
 * qual todo prazo do processo é contado (`UNI-REQ-0111`). O sistema o aplica —
 * não é perguntado a quem configura.
 */
export const FUSO_INSTITUCIONAL = 'America/Belem';

/**
 * O dia de hoje no fuso institucional, em `AAAA-MM-DD`.
 *
 * `new Date().toISOString()` devolveria a data em UTC, que já é a de amanhã
 * depois das 21h em Belém. Uma vigência conferida assim ofereceria um ato horas
 * antes de ele valer — e o servidor, que confere no seu próprio relógio, o
 * recusaria — ou tiraria da lista, cedo demais, um que ainda vale.
 */
export function hojeNoFusoInstitucional(agora: Date = new Date()): string {
  // `en-CA` formata como AAAA-MM-DD, que é a forma comparável com as datas de
  // vigência do contrato. Montar a string a partir das partes evitaria o
  // formato, mas repetiria o que o próprio Intl já resolve.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_INSTITUCIONAL,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

/**
 * Instante ISO a partir do que o campo de data e hora entrega.
 *
 * O `<input type="datetime-local">` devolve `AAAA-MM-DDTHH:mm` **sem fuso**: é
 * uma hora de parede, e sozinha não identifica um momento. Quem a lê no fuso do
 * navegador transforma "8h em Belém" no que forem 8h em São Paulo, e o prazo
 * publicado passa a valer uma hora antes ou depois do que se declarou.
 *
 * A hora digitada é sempre a do fuso institucional, porque é nele que o certame
 * conta os prazos — não no fuso de quem preenche. O deslocamento é perguntado ao
 * `Intl` para a data em questão, em vez de fixado em `-03:00`: fixar acerta hoje
 * e passa a mentir se a regra do fuso mudar, e o erro só apareceria no prazo já
 * publicado.
 */
export function instanteDoCampo(valorLocal: string): string | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(valorLocal.trim());
  if (partes === null) return null;

  const [, ano, mes, dia, hora, minuto] = partes.map(Number);
  const comoSeFosseUtc = Date.UTC(ano, mes - 1, dia, hora, minuto);

  // Duas passagens: a primeira estima o deslocamento pela data lida como se
  // fosse UTC, a segunda o confirma no instante já corrigido — o bastante para
  // uma virada de regra de fuso que caia entre as duas leituras.
  const estimado = deslocamentoEmMinutos(new Date(comoSeFosseUtc));
  const deslocamento = deslocamentoEmMinutos(new Date(comoSeFosseUtc - estimado * 60_000));

  return `${valorLocal.trim()}:00${sufixoDoDeslocamento(deslocamento)}`;
}

/**
 * O que o campo de data e hora precisa exibir para um instante gravado: a hora
 * de parede no fuso institucional, que é como ela foi declarada.
 */
export function campoDoInstante(instanteIso: string): string {
  const instante = new Date(instanteIso);
  if (Number.isNaN(instante.getTime())) return '';

  const partes = partesNoFuso(instante);
  return `${partes.ano}-${partes.mes}-${partes.dia}T${partes.hora}:${partes.minuto}`;
}

function sufixoDoDeslocamento(minutos: number): string {
  if (minutos === 0) return 'Z';
  const sinal = minutos > 0 ? '+' : '-';
  const absoluto = Math.abs(minutos);
  const horas = String(Math.floor(absoluto / 60)).padStart(2, '0');
  const resto = String(absoluto % 60).padStart(2, '0');
  return `${sinal}${horas}:${resto}`;
}

/** Deslocamento do fuso institucional, em minutos, no instante dado. */
function deslocamentoEmMinutos(instante: Date): number {
  const partes = partesNoFuso(instante);
  const comoSeFosseUtc = Date.UTC(
    Number(partes.ano),
    Number(partes.mes) - 1,
    Number(partes.dia),
    Number(partes.hora),
    Number(partes.minuto),
    Number(partes.segundo),
  );
  return Math.round((comoSeFosseUtc - instante.getTime()) / 60_000);
}

interface PartesDoInstante {
  readonly ano: string;
  readonly mes: string;
  readonly dia: string;
  readonly hora: string;
  readonly minuto: string;
  readonly segundo: string;
}

function partesNoFuso(instante: Date): PartesDoInstante {
  const formatador = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_INSTITUCIONAL,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const encontradas = new Map(
    formatador.formatToParts(instante).map((parte) => [parte.type, parte.value]),
  );

  return {
    ano: encontradas.get('year') ?? '0000',
    mes: encontradas.get('month') ?? '01',
    dia: encontradas.get('day') ?? '01',
    // `hour12: false` produz 24 para a meia-noite em alguns motores.
    hora: (encontradas.get('hour') ?? '00') === '24' ? '00' : (encontradas.get('hour') ?? '00'),
    minuto: encontradas.get('minute') ?? '00',
    segundo: encontradas.get('second') ?? '00',
  };
}
