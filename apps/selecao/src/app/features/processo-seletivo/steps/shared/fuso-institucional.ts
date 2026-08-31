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
