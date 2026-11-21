/** Os tipos declarados com o código acrescentado, sem repetição e em ordem alfabética do código. */
export function comTipoDeclarado(declarados: readonly string[], codigo: string): readonly string[] {
  return emOrdemAlfabetica([...declarados, codigo]);
}

/** Os tipos declarados sem o código, sem repetição e em ordem alfabética do código. */
export function semTipoDeclarado(declarados: readonly string[], codigo: string): readonly string[] {
  return emOrdemAlfabetica(declarados.filter((declarado) => declarado !== codigo));
}

/**
 * Cópia dos códigos, sem repetição, na ordem em que o servidor guarda e devolve os tipos; igual a
 * ela, o rascunho não muda sem alteração real. O código que o vocabulário não conhece segue na lista.
 */
export function emOrdemAlfabetica(codigos: readonly string[]): readonly string[] {
  return [...new Set(codigos)].sort();
}
