import {
  deClausulasDoWire,
  paraClausulasDoWire,
  problemaDaCondicao,
  type CondicaoEmClausula,
  type FatoEscolhivel,
} from '../editor-de-condicoes/condicoes-de-fatos';
import type { PredicadoNoWire } from './formulario-editavel';

/** O predicado na forma da API; sem condição, nulo — é como a API diz "sempre". */
export function paraPredicado(condicoes: readonly CondicaoEmClausula[]): PredicadoNoWire {
  const clausulas = paraClausulasDoWire(condicoes);
  return clausulas.length === 0 ? null : clausulas;
}

/**
 * Mantém as condições em edição enquanto elas são o predicado recebido; recopia quando o
 * predicado mudou por fora — outro item, a recarga do servidor.
 */
export function recopiarSeMudouPorFora(
  predicado: PredicadoNoWire,
  anterior: { readonly value: readonly CondicaoEmClausula[] } | undefined,
): readonly CondicaoEmClausula[] {
  if (anterior !== undefined && JSON.stringify(paraPredicado(anterior.value)) === JSON.stringify(predicado)) {
    return anterior.value;
  }
  return deClausulasDoWire(predicado);
}

/** O problema de cada condição em edição, pela posição dela — a forma que o editor de condições mostra. */
export function problemasDasCondicoes(
  condicoes: readonly CondicaoEmClausula[],
  fatos: readonly FatoEscolhivel[],
): Readonly<Record<number, string | undefined>> {
  const porCodigo = new Map(fatos.map((fato) => [fato.codigo, fato]));
  const problemas: Record<number, string | undefined> = {};
  condicoes.forEach((condicao, indice) => {
    problemas[indice] = problemaDaCondicao(condicao, porCodigo) ?? undefined;
  });
  return problemas;
}
