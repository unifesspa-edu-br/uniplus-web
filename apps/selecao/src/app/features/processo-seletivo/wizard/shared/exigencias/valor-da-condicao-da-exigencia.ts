/**
 * O valor de uma condição como o editor o guarda: texto JSON (`"ABC"`, `5`, `true`,
 * `["LB_PPI"]`). O documento aceita o valor já tipado, como lista, texto, número ou booleano.
 */
export function valorDaCondicaoNoEditor(valor: unknown): string {
  return valor === undefined ? '' : JSON.stringify(valor);
}

/**
 * O valor tipado que o documento leva. Texto que não é JSON vale por si, como o servidor o
 * recebe: é o que preserva o que está sendo digitado antes de virar número completo.
 */
export function valorDaCondicaoNoDocumento(texto: string): unknown {
  if (texto === '') return '';
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}
