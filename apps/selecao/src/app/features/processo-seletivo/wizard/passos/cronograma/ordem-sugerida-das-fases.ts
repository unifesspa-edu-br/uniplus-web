import type { FaseCanonicaDto, PrecedenciaFaseDto } from '@uniplus/shared-data/configuracao';

/**
 * Fases em ordem cronológica sugerida, derivada das precedências cadastradas.
 *
 * Ordenação topológica de Kahn sobre as arestas que ligam fases do catálogo,
 * com a ordem do próprio catálogo como desempate — assim o resultado é
 * estável, e não depende da ordem em que as arestas chegaram. Um passe único
 * de ajuste não bastaria: com o catálogo em `B, C, A` e as arestas `B→C` e
 * `A→B`, mover `B` para depois de `A` deixaria `C` antes de `B`, violando a
 * primeira aresta e sugerindo uma ordem que o servidor recusa.
 *
 * Fases que nenhuma aresta alcança entram na ordem do catálogo, e um ciclo no
 * cadastro — que não deveria existir — degrada para essa mesma ordem em vez de
 * perder fase. Isto sugere; quem arbitra continua sendo o servidor.
 */
export function ordemSugeridaDasFases(
  fases: readonly FaseCanonicaDto[],
  precedencias: readonly PrecedenciaFaseDto[],
): readonly FaseCanonicaDto[] {
  const porCodigo = new Map(fases.map((fase) => [fase.codigo, fase]));
  const codigos = ordenarPorPrecedencia(fases, grafoDePrecedencias(porCodigo, precedencias));
  const ordenado = codigos.flatMap((codigo) => porCodigo.get(codigo) ?? []);
  return comFasesForaDaOrdem(fases, ordenado);
}

/**
 * Ciclo no cadastro deixaria fases de fora; devolvê-las na ordem do catálogo é melhor do que
 * sumir com elas do seletor.
 */
function comFasesForaDaOrdem(
  fases: readonly FaseCanonicaDto[],
  ordenado: readonly FaseCanonicaDto[],
): readonly FaseCanonicaDto[] {
  const incluidos = new Set(ordenado.map((fase) => fase.codigo));
  return [...ordenado, ...fases.filter((fase) => !incluidos.has(fase.codigo))];
}

interface GrafoDePrecedencias {
  readonly sucessores: ReadonlyMap<string, readonly string[]>;
  readonly grauDeEntrada: Map<string, number>;
}

/**
 * A fila mantém a ordem do catálogo entre os elegíveis, o que torna o resultado determinístico
 * para o mesmo cadastro; os sucessores liberados voltam à fila respeitando essa ordem, não a de
 * liberação.
 */
function ordenarPorPrecedencia(
  fases: readonly FaseCanonicaDto[],
  { sucessores, grauDeEntrada }: GrafoDePrecedencias,
): string[] {
  const naOrdemDoCatalogo = comparadorPelaOrdemDoCatalogo(fases);
  const prontos = fases.map((f) => f.codigo).filter((codigo) => grauDeEntrada.get(codigo) === 0);
  const ordenado: string[] = [];

  for (let codigo = prontos.shift(); codigo !== undefined; codigo = prontos.shift()) {
    ordenado.push(codigo);
    prontos.push(...liberarSucessores(sucessores.get(codigo) ?? [], grauDeEntrada));
    prontos.sort(naOrdemDoCatalogo);
  }
  return ordenado;
}

function comparadorPelaOrdemDoCatalogo(
  fases: readonly FaseCanonicaDto[],
): (a: string, b: string) => number {
  const posicao = new Map(fases.map((fase, indice) => [fase.codigo, indice]));
  return (a, b) => (posicao.get(a) ?? 0) - (posicao.get(b) ?? 0);
}

/** Os sucessores de cada fase e quantas antecessoras cada uma ainda espera. */
function grafoDePrecedencias(
  porCodigo: ReadonlyMap<string, FaseCanonicaDto>,
  precedencias: readonly PrecedenciaFaseDto[],
): GrafoDePrecedencias {
  const grafo = {
    sucessores: new Map<string, string[]>(),
    grauDeEntrada: new Map<string, number>([...porCodigo.keys()].map((codigo) => [codigo, 0])),
  };
  precedencias
    .filter((a) => porCodigo.has(a.antecessoraCodigo) && porCodigo.has(a.sucessoraCodigo))
    .forEach((aresta) => registrarAresta(grafo, aresta));
  return grafo;
}

function registrarAresta(
  {
    sucessores,
    grauDeEntrada,
  }: { sucessores: Map<string, string[]>; grauDeEntrada: Map<string, number> },
  { antecessoraCodigo, sucessoraCodigo }: PrecedenciaFaseDto,
): void {
  sucessores.set(antecessoraCodigo, [
    ...(sucessores.get(antecessoraCodigo) ?? []),
    sucessoraCodigo,
  ]);
  grauDeEntrada.set(sucessoraCodigo, (grauDeEntrada.get(sucessoraCodigo) ?? 0) + 1);
}

/** Tira uma antecessora de cada sucessor e devolve os que ficaram sem nenhuma a esperar. */
function liberarSucessores(
  sucessores: readonly string[],
  grauDeEntrada: Map<string, number>,
): string[] {
  const liberados: string[] = [];
  for (const sucessor of sucessores) {
    const restante = (grauDeEntrada.get(sucessor) ?? 0) - 1;
    grauDeEntrada.set(sucessor, restante);
    if (restante === 0) liberados.push(sucessor);
  }
  return liberados;
}
