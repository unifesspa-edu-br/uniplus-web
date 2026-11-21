/**
 * Tipos de decisão que o servidor simulado devolve e guarda sem que o vocabulário os publique, cada
 * um com o rótulo que a resposta lhe dá.
 */

/** Um tipo acrescentado no servidor depois: a tela não o conhece, e o servidor o aceita e o guarda. */
export const TIPO_FORA_DO_VOCABULARIO = {
  codigo: 'TIPO_ACRESCENTADO_NO_SERVIDOR',
  rotulo: 'Tipo acrescentado no servidor',
} as const;

/** Um tipo que o servidor devolve na leitura, mas recusa na gravação como não reconhecido. */
export const TIPO_RECUSADO = {
  codigo: 'TIPO_QUE_O_SERVIDOR_NAO_CONHECE',
  rotulo: 'Tipo que o servidor não conhece',
} as const;
