/** As áreas de um critério depois de acrescentar `codigo` ao fim da ordem. */
export function comAreaAcrescentada(areas: readonly string[], codigo: string): readonly string[] {
  return [...areas, codigo];
}

/** As áreas de um critério sem a que ocupa `posicao`. */
export function semAreaNaPosicao(areas: readonly string[], posicao: number): readonly string[] {
  return areas.filter((_, item) => item !== posicao);
}

/** As áreas com a de `posicao` trocada com a de `destino`; `null` quando `destino` não existe. */
export function comAreasTrocadas(
  areas: readonly string[],
  posicao: number,
  destino: number,
): readonly string[] | null {
  if (destino < 0 || destino >= areas.length) return null;
  const trocadas = [...areas];
  [trocadas[posicao], trocadas[destino]] = [trocadas[destino], trocadas[posicao]];
  return trocadas;
}
