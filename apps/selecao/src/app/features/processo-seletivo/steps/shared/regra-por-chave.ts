/** A regra do catálogo identificada por código e versão, que juntos formam a chave dela. */
export function regraPorChave<T extends { readonly codigo: string; readonly versao: string }>(
  regras: readonly T[],
  codigo: string | null,
  versao: string | null,
): T | undefined {
  return regras.find((regra) => regra.codigo === codigo && regra.versao === versao);
}
