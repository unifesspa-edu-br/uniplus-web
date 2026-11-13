/**
 * Conta os caracteres como a pessoa os vê e como a API os limita: por ponto de código, e não por
 * unidade UTF-16. Um emoji ou um ideograma fora do plano básico conta como um, e não como dois.
 */
export function contarCaracteres(texto: string): number {
  return [...texto].length;
}
