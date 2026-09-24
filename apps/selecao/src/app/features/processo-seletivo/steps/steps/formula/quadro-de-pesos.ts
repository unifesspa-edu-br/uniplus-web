import type { PesoAreaEnemDto } from '@uniplus/shared-data/configuracao';
import type { ConfiguracaoClassificacaoDto } from '@uniplus/shared-data/selecao';
import { numeroDaApi, numeroOuNuloDaApi } from '@uniplus/shared-utils';

export interface AreaDoQuadro {
  readonly codigo: string;
  readonly rotulo: string;
  readonly peso: number;
  readonly corte: number | null;
}

export interface GrupoDoQuadro {
  readonly codigo: string;
  readonly rotulo: string;
  readonly baseLegal: string;
  readonly areas: readonly AreaDoQuadro[];
}

export interface ColunaDoQuadro {
  readonly codigo: string;
  readonly rotulo: string;
}

export type GrupoCongelado = ConfiguracaoClassificacaoDto['quadroPesoAreaEnem'][number];

/**
 * As linhas da resolução no cadastro de Peso por Área, como o quadro que a gravação da
 * classificação copia para o processo: grupos pelo código (a mesma ordem da cópia congelada),
 * áreas na ordem que o cadastro devolve. Nenhum grupo nem área é conhecido pela tela.
 */
export function quadroDoCadastro(
  linhas: readonly PesoAreaEnemDto[],
  resolucao: string,
): readonly GrupoDoQuadro[] {
  return ordenarPorCodigo(
    linhas
      .filter((linha) => linha.resolucao === resolucao)
      .map((linha) => ({
        codigo: linha.grupoCurso.codigo,
        rotulo: linha.grupoCurso.rotulo,
        baseLegal: linha.baseLegal,
        areas: linha.areas.map(areaDo),
      })),
  );
}

export function quadroCongelado(grupos: readonly GrupoCongelado[]): readonly GrupoDoQuadro[] {
  return ordenarPorCodigo(
    grupos.map((grupo) => ({
      codigo: grupo.grupoAreaEnem.codigo,
      rotulo: grupo.grupoAreaEnem.rotulo,
      baseLegal: grupo.baseLegal,
      areas: grupo.areas.map(areaDo),
    })),
  );
}

/**
 * Os dois quadros dizem o mesmo: mesmos grupos, áreas, pesos, cortes, rótulos e base legal. A
 * ordem das áreas não conta — a cópia congelada vem ordenada por código, e o cadastro, na ordem
 * canônica das áreas.
 */
export function mesmoQuadro(a: readonly GrupoDoQuadro[], b: readonly GrupoDoQuadro[]): boolean {
  return JSON.stringify(normalizado(a)) === JSON.stringify(normalizado(b));
}

/** Algum grupo de `congelado` não está mais em `cadastro` — a resolução ficou incompleta lá. */
export function perdeuGrupo(
  congelado: readonly GrupoDoQuadro[],
  cadastro: readonly GrupoDoQuadro[],
): boolean {
  const noCadastro = new Set(cadastro.map((grupo) => grupo.codigo));
  return congelado.some((grupo) => !noCadastro.has(grupo.codigo));
}

export function ordemDasAreas(
  areas: readonly { readonly codigo: string }[],
): ReadonlyMap<string, number> {
  return new Map(areas.map((area, posicao) => [area.codigo, posicao]));
}

/**
 * As áreas que viram colunas, na ordem canônica — a mesma para a prévia e para a cópia congelada,
 * para as colunas não trocarem de lugar. Montar a partir de todos os grupos, e não só do primeiro,
 * evita esconder uma área que falte a ele; código que a lista canônica não conhece vai para o fim.
 */
export function colunasDoQuadro(
  quadro: readonly GrupoDoQuadro[],
  ordem: ReadonlyMap<string, number>,
): readonly ColunaDoQuadro[] {
  const colunas = new Map<string, ColunaDoQuadro>();
  for (const grupo of quadro) {
    for (const area of grupo.areas) {
      if (!colunas.has(area.codigo)) {
        colunas.set(area.codigo, { codigo: area.codigo, rotulo: area.rotulo });
      }
    }
  }
  const posicao = (codigo: string) => ordem.get(codigo) ?? Number.MAX_SAFE_INTEGER;
  return [...colunas.values()].sort((a, b) => posicao(a.codigo) - posicao(b.codigo));
}

function areaDo(area: {
  readonly codigo: string;
  readonly rotulo: string;
  readonly peso: number | string;
  readonly corte: null | number | string;
}): AreaDoQuadro {
  return {
    codigo: area.codigo,
    rotulo: area.rotulo,
    peso: numeroDaApi(area.peso),
    corte: numeroOuNuloDaApi(area.corte),
  };
}

function ordenarPorCodigo(grupos: GrupoDoQuadro[]): readonly GrupoDoQuadro[] {
  return grupos.sort(porCodigo);
}

function normalizado(quadro: readonly GrupoDoQuadro[]): readonly GrupoDoQuadro[] {
  return ordenarPorCodigo(
    quadro.map((grupo) => ({
      ...grupo,
      areas: [...grupo.areas].sort(porCodigo),
    })),
  );
}

/** Ordinal, como o servidor ordena os códigos na cópia congelada. */
function porCodigo(a: { readonly codigo: string }, b: { readonly codigo: string }): number {
  return a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0;
}
