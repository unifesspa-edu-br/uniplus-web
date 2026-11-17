import { paresPorOrigem } from './itens-por-origem';

export function itensEditadosPorOrigem<A, V extends { readonly origem?: number }>(
  atuais: readonly A[] | undefined,
  valores: readonly V[],
  alterar: (atual: A | undefined, valores: V) => A,
): A[] {
  const comOrigens = valores.map((valor) => ({ ...valor, origem: valor.origem ?? null }));
  return paresPorOrigem(atuais ?? [], comOrigens).map(([atual, valor]) => alterar(atual, valor));
}
