/** Descreve a posição atual na navegação do processo. */
export function descricaoDoPasso(indice: number, rotulos: readonly string[]): string {
  return `Etapa ${indice + 1} de ${rotulos.length} (${String(indice + 1).padStart(2, '0')} ${rotulos[indice]})`;
}
