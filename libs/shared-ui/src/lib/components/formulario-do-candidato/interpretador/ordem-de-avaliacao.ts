/** Os derivados e os agregados entram assim que as dependências estão prontas. */
export const PRIORIDADE_DERIVADO = -1;

export interface No {
  readonly codigo: string;
  readonly citados: readonly string[];
  readonly prioridade: number;
}

/**
 * A ordem topológica dos nós, desempatada pela prioridade e pela posição; o nó que cita a si mesmo,
 * pertence a um ciclo ou depende de um nunca fica pronto e sai fora de ordem.
 */
export function ordenar(nos: readonly No[]): {
  ordem: readonly string[];
  foraDeOrdem: readonly string[];
} {
  const indice = new Map(nos.map((no, i) => [no.codigo, i]));
  const pendentes = nos.map(() => 0);
  const dependentes: number[][] = nos.map(() => []);
  nos.forEach((no, i) => {
    for (const citado of new Set(no.citados)) {
      const dependencia = indice.get(citado);
      if (dependencia === undefined) continue;
      pendentes[i]++;
      if (dependencia !== i) dependentes[dependencia].push(i);
    }
  });

  const prontos = nos.map((_, i) => i).filter((i) => pendentes[i] === 0);
  const ordem: string[] = [];
  while (prontos.length > 0) {
    prontos.sort((a, b) => nos[a].prioridade - nos[b].prioridade || a - b);
    const atual = prontos.shift() as number;
    ordem.push(nos[atual].codigo);
    for (const dependente of dependentes[atual]) {
      if (--pendentes[dependente] === 0) prontos.push(dependente);
    }
  }
  const ordenados = new Set(ordem);
  return { ordem, foraDeOrdem: nos.map((n) => n.codigo).filter((c) => !ordenados.has(c)) };
}
