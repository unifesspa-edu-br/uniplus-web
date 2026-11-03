/** Os valores que aparecem mais de uma vez na lista, cada um uma vez só. */
export function repetidos<T>(valores: readonly T[]): readonly T[] {
  const vistos = new Set<T>();
  const repetidos = new Set<T>();
  for (const valor of valores) {
    if (vistos.has(valor)) repetidos.add(valor);
    vistos.add(valor);
  }
  return [...repetidos];
}
