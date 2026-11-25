/** Os derivados e os agregados entram assim que as dependências estão prontas. */
export const PRIORIDADE_DERIVADO = -1;

export interface FatoAOrdenar {
  readonly codigo: string;
  readonly citados: readonly string[];
  readonly prioridade: number;
}

/** A prioridade e a posição desempatarão fatos cujas dependências estão prontas. */
export function ordenar(fatos: readonly FatoAOrdenar[]): {
  ordem: readonly string[];
  foraDeOrdem: readonly string[];
} {
  const { pendentes, dependentes } = dependenciasDosFatos(fatos);
  const ordem = ordenarFatosProntos(fatos, pendentes, dependentes);
  const ordenados = new Set(ordem);
  return { ordem, foraDeOrdem: fatos.map((f) => f.codigo).filter((c) => !ordenados.has(c)) };
}

function dependenciasDosFatos(fatos: readonly FatoAOrdenar[]): {
  pendentes: number[];
  dependentes: number[][];
} {
  const indice = new Map(fatos.map((fato, i) => [fato.codigo, i]));
  const pendentes = fatos.map(() => 0);
  const dependentes: number[][] = fatos.map(() => []);
  fatos.forEach((fato, i) => registrarDependencias(fato, i, indice, { pendentes, dependentes }));
  return { pendentes, dependentes };
}

function registrarDependencias(
  fato: FatoAOrdenar,
  i: number,
  indice: Map<string, number>,
  { pendentes, dependentes }: { pendentes: number[]; dependentes: number[][] },
): void {
  for (const citado of new Set(fato.citados)) {
    const dependencia = indice.get(citado);
    if (dependencia === undefined) continue;
    pendentes[i]++;
    if (dependencia !== i) dependentes[dependencia].push(i);
  }
}

function ordenarFatosProntos(
  fatos: readonly FatoAOrdenar[],
  pendentes: number[],
  dependentes: number[][],
): string[] {
  const prontos = fatos.map((_, i) => i).filter((i) => pendentes[i] === 0);
  const ordem: string[] = [];
  while (prontos.length > 0) {
    prontos.sort((a, b) => fatos[a].prioridade - fatos[b].prioridade || a - b);
    const atual = prontos.shift() as number;
    ordem.push(fatos[atual].codigo);
    liberarDependentes(dependentes[atual], pendentes, prontos);
  }
  return ordem;
}

function liberarDependentes(dependentes: number[], pendentes: number[], prontos: number[]): void {
  for (const dependente of dependentes) {
    if (--pendentes[dependente] === 0) prontos.push(dependente);
  }
}
