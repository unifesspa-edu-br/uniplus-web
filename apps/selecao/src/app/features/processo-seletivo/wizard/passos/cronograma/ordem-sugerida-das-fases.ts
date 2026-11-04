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

  const sucessores = new Map<string, string[]>();
  const grauDeEntrada = new Map<string, number>(fases.map((fase) => [fase.codigo, 0]));

  for (const aresta of precedencias) {
    if (!porCodigo.has(aresta.antecessoraCodigo) || !porCodigo.has(aresta.sucessoraCodigo)) {
      continue;
    }
    sucessores.set(aresta.antecessoraCodigo, [
      ...(sucessores.get(aresta.antecessoraCodigo) ?? []),
      aresta.sucessoraCodigo,
    ]);
    grauDeEntrada.set(aresta.sucessoraCodigo, (grauDeEntrada.get(aresta.sucessoraCodigo) ?? 0) + 1);
  }

  // A fila mantém a ordem do catálogo entre os elegíveis, o que torna o
  // resultado determinístico para o mesmo cadastro.
  const prontos = fases.filter((fase) => grauDeEntrada.get(fase.codigo) === 0).map((f) => f.codigo);
  const ordenado: FaseCanonicaDto[] = [];

  for (let codigo = prontos.shift(); codigo !== undefined; codigo = prontos.shift()) {
    const fase = porCodigo.get(codigo);
    if (fase !== undefined) ordenado.push(fase);

    const liberados: string[] = [];
    for (const sucessor of sucessores.get(codigo) ?? []) {
      const restante = (grauDeEntrada.get(sucessor) ?? 0) - 1;
      grauDeEntrada.set(sucessor, restante);
      if (restante === 0) liberados.push(sucessor);
    }

    // Reinsere respeitando a ordem do catálogo, não a de liberação.
    prontos.push(...liberados);
    prontos.sort(
      (a, b) => fases.findIndex((f) => f.codigo === a) - fases.findIndex((f) => f.codigo === b),
    );
  }

  // Ciclo no cadastro deixaria fases de fora; devolvê-las na ordem do
  // catálogo é melhor do que sumir com elas do seletor.
  const incluidos = new Set(ordenado.map((fase) => fase.codigo));
  return [...ordenado, ...fases.filter((fase) => !incluidos.has(fase.codigo))];
}
