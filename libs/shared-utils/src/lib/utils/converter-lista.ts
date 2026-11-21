/** Converte cada item da lista e mantém ausente (`null` ou `undefined`) a lista ausente. */
export function converterLista<T, U>(lista: readonly T[], converter: (item: T) => U): U[];
export function converterLista<T, U>(
  lista: readonly T[] | null,
  converter: (item: T) => U,
): U[] | null;
export function converterLista<T, U>(
  lista: readonly T[] | null | undefined,
  converter: (item: T) => U,
): U[] | null | undefined;
export function converterLista<T, U>(
  lista: readonly T[] | null | undefined,
  converter: (item: T) => U,
): U[] | null | undefined {
  if (lista === null || lista === undefined) return lista;
  return lista.map((item) => converter(item));
}
