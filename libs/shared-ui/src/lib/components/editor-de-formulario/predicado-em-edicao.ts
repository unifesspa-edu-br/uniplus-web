import {
  deClausulasDoWire,
  paraClausulasDoWire,
  type CondicaoEmClausula,
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
