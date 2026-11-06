import type { UnidadeDto } from '@uniplus/shared-data/organizacao';

export interface NoDaArvore {
  readonly unidade: UnidadeDto;
  readonly children: readonly NoDaArvore[];
}

/**
 * Monta a árvore do conjunto carregado. Com filtro ativo, a unidade cujo pai ficou fora do
 * conjunto aparece como raiz: não há endpoint de hierarquia dedicado.
 */
export function montarArvore(unidades: readonly UnidadeDto[]): readonly NoDaArvore[] {
  const nos = new Map<string, { unidade: UnidadeDto; children: NoDaArvore[] }>();
  for (const unidade of unidades) {
    nos.set(unidade.id, { unidade, children: [] });
  }
  const raizes: NoDaArvore[] = [];
  for (const no of nos.values()) {
    const idDoPai = no.unidade.unidadeSuperiorId;
    const pai = idDoPai === null ? undefined : nos.get(idDoPai);
    if (pai === undefined) {
      raizes.push(no);
    } else {
      pai.children.push(no);
    }
  }
  return ordenar(raizes);
}

function ordenar(nos: readonly NoDaArvore[]): readonly NoDaArvore[] {
  return [...nos]
    .sort((a, b) => a.unidade.nome.localeCompare(b.unidade.nome, 'pt-BR'))
    .map((no) => ({ ...no, children: ordenar(no.children) }));
}

/** Ids de todo nó que tem filhos: os únicos que o botão de expandir alcança. */
export function idsDosNosComFilhos(nos: readonly NoDaArvore[]): Set<string> {
  const ids = new Set<string>();
  const visitar = (lista: readonly NoDaArvore[]): void => {
    for (const no of lista) {
      if (no.children.length > 0) {
        ids.add(no.unidade.id);
        visitar(no.children);
      }
    }
  };
  visitar(nos);
  return ids;
}
