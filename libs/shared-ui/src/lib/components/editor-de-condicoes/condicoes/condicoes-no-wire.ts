import { CondicaoEmClausula, numerosDeClausula } from './condicoes-em-clausulas';
import { interpretar } from './valor-da-condicao';

/**
 * Uma condição na forma em que a API a recebe e a devolve: o valor é o JSON já interpretado
 * (`true`, `18`, `"PRETA"`, `["AC", "LB_PPI"]`), e não texto.
 */
export interface CondicaoNoWire {
  readonly fato: string;
  readonly operador: string;
  readonly valor: unknown;
}

/**
 * O predicado na forma aninhada da API — cláusulas combinadas por OU, cada uma com as condições
 * combinadas por E — para a lista que o editor edita, com o número da cláusula em cada condição.
 * Nulo ou vazio é predicado sem condição.
 */
export function deClausulasDoWire(
  clausulas: readonly (readonly CondicaoNoWire[])[] | null | undefined,
): readonly CondicaoEmClausula[] {
  return (clausulas ?? []).flatMap((condicoes, indice) =>
    condicoes.map((condicao) => ({
      clausula: indice + 1,
      fato: condicao.fato,
      operador: condicao.operador,
      valor: JSON.stringify(condicao.valor),
    })),
  );
}

/**
 * A lista do editor de volta à forma aninhada da API, uma cláusula por número, na ordem. O valor
 * que não é JSON segue como texto — é como o servidor o recebe, e a conferência da tela já o
 * cobrou antes de gravar.
 */
export function paraClausulasDoWire(condicoes: readonly CondicaoEmClausula[]): CondicaoNoWire[][] {
  return numerosDeClausula(condicoes)
    .map((numero) =>
      condicoes
        .filter((condicao) => condicao.clausula === numero)
        .map((condicao) => ({
          fato: condicao.fato,
          operador: condicao.operador,
          valor: interpretar(condicao.valor) ?? condicao.valor,
        })),
    )
    .filter((clausula) => clausula.length > 0);
}
