import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Fitness de arquitetura (Stories #245 + #246):
 *
 * Defesa em profundidade behind o ESLint inline. Re-asserta os mesmos
 * invariantes que `@nx/enforce-module-boundaries` aplica no editor —
 * mas ao nível de `nx run-many --target=test`, gated por CI.
 *
 * Por que duplicar?
 *
 * - ESLint pode ser silenciado por `eslint-disable`, regras misconfiguradas
 *   ou projetos opt-out — o spec não.
 * - O fitness também detecta **ciclos** no project graph (back-edges em
 *   DFS), que `enforce-module-boundaries` não cobre.
 *
 * Pattern source: `runtime-config-providers.fitness.spec.ts` (ADR-0021)
 * — vitest + regex parsing de fontes + comment strip antes do match.
 */

const WORKSPACE_ROOT = path.resolve(__dirname, '../../../../..');

interface DepConstraint {
  sourceTag: string;
  onlyDependOnLibsWithTags: string[];
}

interface NxNode {
  data: { tags?: string[] };
}

interface NxEdge {
  source: string;
  target: string;
  type: string;
}

interface NxGraph {
  nodes: Record<string, NxNode>;
  dependencies: Record<string, NxEdge[]>;
}

function carregarGraph(): NxGraph {
  const out = path.join('/tmp', `uniplus-fitness-graph-${process.pid}.json`);
  try {
    execSync(`npx nx graph --file=${out}`, {
      cwd: WORKSPACE_ROOT,
      stdio: 'pipe',
    });
    const conteudo = fs.readFileSync(out, 'utf-8');
    return JSON.parse(conteudo).graph as NxGraph;
  } finally {
    if (fs.existsSync(out)) fs.unlinkSync(out);
  }
}

function extrairDepConstraints(): DepConstraint[] {
  const filePath = path.join(WORKSPACE_ROOT, 'eslint.config.mjs');
  const source = fs.readFileSync(filePath, 'utf-8');
  // Strip comentários antes do match — caso contrário, menções a
  // `sourceTag: 'type:foo'` em JSDoc/inline produzem falsos positivos.
  const semComentarios = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  const re =
    /sourceTag:\s*'([^']+)'\s*,\s*onlyDependOnLibsWithTags:\s*\[([\s\S]*?)\]/g;
  const entries: DepConstraint[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(semComentarios)) !== null) {
    const sourceTag = match[1];
    const tags = [...match[2].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    entries.push({ sourceTag, onlyDependOnLibsWithTags: tags });
  }
  return entries;
}

interface ResultadoAdmite {
  ok: boolean;
  constraint: DepConstraint | null;
}

function admiteDependencia(
  sourceTags: string[],
  targetTags: string[],
  constraints: DepConstraint[],
): ResultadoAdmite {
  // Para cada constraint cujo `sourceTag` bate com alguma tag do source,
  // o target precisa ter ao menos uma tag listada em
  // `onlyDependOnLibsWithTags`. Se qualquer constraint aplicável falha,
  // a dep viola.
  const aplicaveis = constraints.filter((c) => sourceTags.includes(c.sourceTag));
  for (const c of aplicaveis) {
    const satisfaz = targetTags.some((t) =>
      c.onlyDependOnLibsWithTags.includes(t),
    );
    if (!satisfaz) {
      return { ok: false, constraint: c };
    }
  }
  return { ok: true, constraint: null };
}

function detectarCiclos(graph: NxGraph): string[][] {
  const ciclos: string[][] = [];
  const visitado = new Set<string>();
  const ativo = new Set<string>();
  const stack: string[] = [];

  function dfs(node: string): void {
    if (ativo.has(node)) {
      const idx = stack.indexOf(node);
      if (idx !== -1) {
        ciclos.push([...stack.slice(idx), node]);
      }
      return;
    }
    if (visitado.has(node)) return;
    ativo.add(node);
    stack.push(node);
    const edges = graph.dependencies[node] ?? [];
    for (const e of edges) {
      // npm:* são deps externas — graph as inclui como nodes mas elas
      // não têm tags do eixo nx. Pular.
      if (e.target.startsWith('npm:')) continue;
      if (graph.nodes[e.target]) dfs(e.target);
    }
    stack.pop();
    ativo.delete(node);
    visitado.add(node);
  }

  for (const node of Object.keys(graph.nodes)) {
    if (!visitado.has(node)) dfs(node);
  }
  return ciclos;
}

describe('Fitness — architecture boundaries (Stories #245 + #246)', () => {
  let graph: NxGraph;
  let constraints: DepConstraint[];

  beforeAll(() => {
    graph = carregarGraph();
    constraints = extrairDepConstraints();
  });

  describe('depConstraints (eixo de tags)', () => {
    it('extrai ao menos 11 entradas (4 scope:* + 7 type:*)', () => {
      expect(
        constraints.length,
        `\nEsperado >= 11 entradas em eslint.config.mjs depConstraints; obtido ${constraints.length}. Refactor que reduza ou quebre o regex extrairDepConstraints invalida o gate — investigue.`,
      ).toBeGreaterThanOrEqual(11);
    });

    it('todo edge do project graph respeita as constraints', () => {
      const violacoes: string[] = [];
      for (const [source, edges] of Object.entries(graph.dependencies)) {
        const sourceTags = graph.nodes[source]?.data.tags ?? [];
        for (const edge of edges) {
          if (edge.target.startsWith('npm:')) continue;
          const targetNode = graph.nodes[edge.target];
          if (!targetNode) continue;
          const targetTags = targetNode.data.tags ?? [];
          const resultado = admiteDependencia(
            sourceTags,
            targetTags,
            constraints,
          );
          if (!resultado.ok && resultado.constraint) {
            violacoes.push(
              `  ${source} [${sourceTags.join(', ')}] -> ${edge.target} [${targetTags.join(', ')}] ` +
                `viola constraint sourceTag=${resultado.constraint.sourceTag} ` +
                `(precisa ao menos uma de [${resultado.constraint.onlyDependOnLibsWithTags.join(', ')}])`,
            );
          }
        }
      }
      expect(
        violacoes,
        violacoes.length > 0
          ? `\nViolações de boundary detectadas:\n${violacoes.join('\n')}`
          : '',
      ).toEqual([]);
    });
  });

  describe('aciclicidade do project graph', () => {
    it('graph é acíclico (sem back-edges entre projects)', () => {
      const ciclos = detectarCiclos(graph);
      expect(
        ciclos,
        ciclos.length > 0
          ? `\nCiclos detectados no project graph:\n${ciclos.map((c) => '  ' + c.join(' -> ')).join('\n')}`
          : '',
      ).toEqual([]);
    });
  });
});
