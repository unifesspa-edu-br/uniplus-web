import { mudouDeOrdem } from './partes-por-chave';

/** Um item do formulário que sabe a posição que o item do documento ocupava quando foi lido. */
export interface ComOrigem {
  readonly origem: number | null;
}

export type ParPorOrigem<A, V> = readonly [A | undefined, V];

/**
 * Cada valor do formulário com o item do documento de onde veio. O item sem chave é identificado
 * pela posição que tinha ao ser lido; `null` é item criado no formulário, e uma posição repetida
 * vale só para o primeiro valor que a cita, porque o item do documento é um só.
 */
export function paresPorOrigem<A, V extends ComOrigem>(
  atuais: readonly A[],
  valores: readonly V[],
): ParPorOrigem<A, V>[] {
  const usadas = new Set<number>();
  return valores.map((valor) => {
    const { origem } = valor;
    if (origem === null || usadas.has(origem)) return [undefined, valor];
    usadas.add(origem);
    return [atuais[origem], valor];
  });
}

/** Se a lista ganhou item ou algum item passou a vir antes de outro que antes o precedia. */
export function ordemFoiMexida<A, V>(
  atuais: readonly A[],
  pares: readonly ParPorOrigem<A, V>[],
): boolean {
  const existentes = pares.flatMap(([atual, valor]) =>
    atual === undefined ? [] : [[atual, valor] as const],
  );
  return pares.some(([atual]) => atual === undefined) || mudouDeOrdem(atuais, existentes);
}
