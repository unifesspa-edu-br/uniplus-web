import { DependencyType, readCachedProjectGraph, type ProjectGraph } from '@nx/devkit';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * O lint confere tags e ciclos a partir de cada import. Dependência declarada em
 * `implicitDependencies` não passa por import, e um ciclo fechado só por ela escapa
 * do lint; por isso a ausência de ciclo no grafo inteiro é conferida aqui.
 */

type Dependencia = [origem: string, destino: string, tipo: DependencyType];

interface BuscaDeCiclos {
  grafo: ProjectGraph;
  concluidos: Set<string>;
  caminho: string[];
  ciclos: string[][];
}

function grafoDeProjetosCalculadoPeloNx(): ProjectGraph {
  try {
    return readCachedProjectGraph();
  } catch (erro) {
    throw new Error(
      'O grafo de projetos do Nx não está disponível. Rode pelo Nx (npx nx test shared-data), que calcula o grafo antes da tarefa.',
      { cause: erro },
    );
  }
}

function grafoDeProjetos(projetos: string[], dependencias: Dependencia[]): ProjectGraph {
  const grafo: ProjectGraph = { nodes: {}, dependencies: {} };
  for (const projeto of projetos) {
    grafo.nodes[projeto] = { name: projeto, type: 'lib', data: { root: projeto } };
    grafo.dependencies[projeto] = [];
  }
  for (const [origem, destino, tipo] of dependencias) {
    grafo.dependencies[origem].push({ source: origem, target: destino, type: tipo });
  }
  return grafo;
}

function projetosDependidos(grafo: ProjectGraph, projeto: string): string[] {
  return (grafo.dependencies[projeto] ?? [])
    .map((dependencia) => dependencia.target)
    .filter((destino) => destino in grafo.nodes);
}

function visitar(projeto: string, busca: BuscaDeCiclos): void {
  const posicaoNoCaminho = busca.caminho.indexOf(projeto);
  if (posicaoNoCaminho >= 0) {
    busca.ciclos.push([...busca.caminho.slice(posicaoNoCaminho), projeto]);
    return;
  }
  if (busca.concluidos.has(projeto)) return;
  busca.caminho.push(projeto);
  projetosDependidos(busca.grafo, projeto).forEach((destino) => visitar(destino, busca));
  busca.caminho.pop();
  busca.concluidos.add(projeto);
}

function ciclosDoGrafo(grafo: ProjectGraph): string[][] {
  const busca: BuscaDeCiclos = { grafo, concluidos: new Set(), caminho: [], ciclos: [] };
  Object.keys(grafo.nodes).forEach((projeto) => visitar(projeto, busca));
  return busca.ciclos;
}

function descreverCiclos(ciclos: string[][]): string {
  return ciclos.map((ciclo) => `  ${ciclo.join(' -> ')}`).join('\n');
}

describe('Fitness — grafo de projetos sem ciclo', () => {
  let grafo: ProjectGraph;

  beforeAll(() => {
    grafo = grafoDeProjetosCalculadoPeloNx();
  });

  it('lê do Nx o grafo com o projeto shared-data', () => {
    expect(Object.keys(grafo.nodes)).toContain('shared-data');
  });

  it('não tem ciclo entre os projetos, contando as dependências implícitas', () => {
    const ciclos = ciclosDoGrafo(grafo);

    expect(ciclos, `\nCiclos no grafo de projetos:\n${descreverCiclos(ciclos)}`).toEqual([]);
  });

  describe('detecção de ciclo', () => {
    it('acha o ciclo formado só por dependências implícitas', () => {
      const sintetico = grafoDeProjetos(
        ['aplicacao', 'aplicacao-e2e'],
        [
          ['aplicacao', 'aplicacao-e2e', DependencyType.implicit],
          ['aplicacao-e2e', 'aplicacao', DependencyType.implicit],
        ],
      );

      expect(ciclosDoGrafo(sintetico)).toEqual([['aplicacao', 'aplicacao-e2e', 'aplicacao']]);
    });

    it('acha o ciclo que mistura dependência estática e implícita', () => {
      const sintetico = grafoDeProjetos(
        ['a', 'b', 'c'],
        [
          ['a', 'b', DependencyType.static],
          ['b', 'c', DependencyType.static],
          ['c', 'a', DependencyType.implicit],
        ],
      );

      expect(ciclosDoGrafo(sintetico)).toEqual([['a', 'b', 'c', 'a']]);
    });

    it('não acusa ciclo em grafo em diamante', () => {
      const sintetico = grafoDeProjetos(
        ['a', 'b', 'c', 'd'],
        [
          ['a', 'b', DependencyType.static],
          ['a', 'c', DependencyType.static],
          ['b', 'd', DependencyType.static],
          ['c', 'd', DependencyType.static],
        ],
      );

      expect(ciclosDoGrafo(sintetico)).toEqual([]);
    });

    it('ignora a dependência de pacote externo', () => {
      const sintetico = grafoDeProjetos(['a'], [['a', 'npm:rxjs', DependencyType.static]]);

      expect(ciclosDoGrafo(sintetico)).toEqual([]);
    });
  });
});
