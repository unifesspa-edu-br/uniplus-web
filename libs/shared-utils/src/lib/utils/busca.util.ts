/**
 * Forma de um texto para busca por trecho: sem acento, sem caixa e sem espaço
 * nas pontas. É como as pessoas digitam, e não é como o cadastro grava —
 * compare sempre os dois lados normalizados.
 */
export function normalizarParaBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}
