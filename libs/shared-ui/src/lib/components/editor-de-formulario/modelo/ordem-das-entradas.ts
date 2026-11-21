import { ConteudoDoFormulario, EntradaDaSecao, EtapaDoFormulario } from './tipos';

/** Uma entrada e a vizinha com quem ela troca de lugar. */
export interface TrocaComAVizinha<T> {
  readonly atual: T;
  readonly vizinha: T;
}

/** As etapas em ordem. */
export function etapasEmOrdem(conteudo: ConteudoDoFormulario): readonly EtapaDoFormulario[] {
  return [...(conteudo.etapas ?? [])].sort((a, b) => a.ordem - b.ordem);
}

/** Os itens e os grupos de uma seção, em ordem: a numeração é uma só para os dois. */
export function entradasDaSecao(
  conteudo: ConteudoDoFormulario,
  etapaCodigo: string,
): readonly EntradaDaSecao[] {
  const itens: EntradaDaSecao[] = (conteudo.itens ?? [])
    .filter((item) => item.etapaCodigo === etapaCodigo)
    .map((item) => ({ tipo: 'item', item }));
  const grupos: EntradaDaSecao[] = (conteudo.grupos ?? [])
    .filter((grupo) => grupo.etapaCodigo === etapaCodigo)
    .map((grupo) => ({ tipo: 'grupo', grupo }));
  return [...itens, ...grupos].sort((a, b) => ordemDa(a) - ordemDa(b));
}

/**
 * Numera de novo, sem buracos: as etapas pela posição, e os itens e grupos numa ordem única que
 * acompanha a das seções — a API recusa item de seção posterior antes de item de seção anterior.
 */
export function renumerar(conteudo: ConteudoDoFormulario): ConteudoDoFormulario {
  const etapas = etapasEmOrdem(conteudo);
  return {
    ...conteudo,
    etapas: etapas.map((etapa, indice) => ({ ...etapa, ordem: indice })),
    ...entradasRenumeradas(conteudo, numerarEntradas(conteudo, etapas)),
  };
}

/** Itens e grupos com a ordem nova; o que não está em seção alguma vai depois de todos. */
function entradasRenumeradas(
  conteudo: ConteudoDoFormulario,
  { ordemDoItem, ordemDoGrupo, proxima }: EntradasNumeradas,
): Pick<ConteudoDoFormulario, 'itens' | 'grupos'> {
  let sobra = proxima;
  const depois = (): number => sobra++;
  return {
    itens: comOrdem(conteudo.itens ?? [], (item) => item.fatoCodigo, ordemDoItem, depois),
    grupos: comOrdem(conteudo.grupos ?? [], (grupo) => grupo.codigo, ordemDoGrupo, depois),
  };
}

function comOrdem<T extends { readonly ordem: number }>(
  lista: readonly T[],
  chaveDe: (elemento: T) => string,
  ordens: ReadonlyMap<string, number>,
  depois: () => number,
): T[] {
  return lista.map((elemento) => ({
    ...elemento,
    ordem: ordens.get(chaveDe(elemento)) ?? depois(),
  }));
}

interface EntradasNumeradas {
  readonly ordemDoItem: ReadonlyMap<string, number>;
  readonly ordemDoGrupo: ReadonlyMap<string, number>;
  readonly proxima: number;
}

function numerarEntradas(
  conteudo: ConteudoDoFormulario,
  etapas: readonly EtapaDoFormulario[],
): EntradasNumeradas {
  const ordemDoItem = new Map<string, number>();
  const ordemDoGrupo = new Map<string, number>();
  let proxima = 0;
  for (const etapa of etapas) {
    for (const entrada of entradasDaSecao(conteudo, etapa.codigo)) {
      if (entrada.tipo === 'item') ordemDoItem.set(entrada.item.fatoCodigo, proxima++);
      else ordemDoGrupo.set(entrada.grupo.codigo, proxima++);
    }
  }
  return { ordemDoItem, ordemDoGrupo, proxima };
}

export function ordemDa(entrada: EntradaDaSecao): number {
  return entrada.tipo === 'item' ? entrada.item.ordem : entrada.grupo.ordem;
}

/**
 * A ordem do primeiro item das etapas a partir da dada: a posição da etapa no grafo da API é a do
 * primeiro item dela. Sem item adiante, fica depois de todos.
 */
export function primeiraOrdemDaEtapa(conteudo: ConteudoDoFormulario, ordemDaEtapa: number): number {
  const ordens = etapasEmOrdem(conteudo)
    .filter((etapa) => etapa.ordem >= ordemDaEtapa)
    .flatMap((etapa) => entradasDaSecao(conteudo, etapa.codigo).map(ordemDa));
  return ordens.length > 0 ? Math.min(...ordens) : Number.MAX_SAFE_INTEGER;
}

/**
 * A ordem de uma entrada nova no fim da seção: logo depois da última entrada — ou no começo da
 * seção, se vazia —; a renumeração fecha o buraco.
 */
export function ordemNoFimDaSecao(conteudo: ConteudoDoFormulario, etapaCodigo: string): number {
  const ultima = entradasDaSecao(conteudo, etapaCodigo).at(-1);
  if (ultima !== undefined) return ordemDa(ultima) + 0.5;
  const etapa = (conteudo.etapas ?? []).find((e) => e.codigo === etapaCodigo);
  return primeiraOrdemDaEtapa(conteudo, etapa?.ordem ?? 0) - 0.5;
}
