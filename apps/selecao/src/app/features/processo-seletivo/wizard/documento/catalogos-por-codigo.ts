/** O que o catálogo oferece para reconhecer um item: o código estável e o rótulo legível. */
export interface ItemDoCatalogo {
  readonly codigo: string;
  readonly rotulo: string;
}

/** Rótulo de cada item do catálogo vivo, pelo código: o documento nunca guarda o id do cadastro. */
export type CatalogoPorCodigo = ReadonlyMap<string, string>;

export function catalogoPorCodigo(itens: readonly ItemDoCatalogo[]): CatalogoPorCodigo {
  return new Map(itens.map((item) => [item.codigo, item.rotulo]));
}

/**
 * O rótulo que o documento gravou vale primeiro: processo publicado mostra o que foi congelado,
 * sem reler o cadastro vivo. Item recém-escolhido ainda não tem rótulo gravado e usa o catálogo;
 * sem nenhum dos dois, o código identifica o item.
 */
export function rotuloDoCodigo(
  catalogo: CatalogoPorCodigo,
  codigo: string,
  rotuloGravado: string | undefined,
): string {
  return rotuloGravado ?? catalogo.get(codigo) ?? codigo;
}
