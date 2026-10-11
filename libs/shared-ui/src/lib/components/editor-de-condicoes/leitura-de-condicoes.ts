/**
 * A leitura em prosa do que o editor escreve, para quem confere a regra sem abrir o editor: o
 * nome do fato, a comparação como o editor a oferece e o valor pela descrição do cadastro.
 */

import {
  VALOR_FALSO,
  VALOR_VERDADEIRO,
  clausulasDe,
  comparaComLista,
  operadoresDoFato,
  rotuloDoValor,
  valorEscalarDe,
  valoresDeListaDe,
  type CondicaoDeFato,
  type CondicaoEmClausula,
  type FatoEscolhivel,
} from './condicoes-de-fatos';

/** A condição como frase: o fato, a comparação que o editor oferece e o valor escolhido. */
export function descreverCondicao(
  condicao: CondicaoDeFato,
  fato: FatoEscolhivel | undefined,
): string {
  if (fato === undefined) return `${condicao.fato} — fora do catálogo`;

  const operador =
    operadoresDoFato(fato).find((opcao) => opcao.valor === condicao.operador)?.rotulo ??
    condicao.operador;
  return `${fato.nome} ${operador} ${valorDescrito(condicao, fato)}`;
}

/**
 * Cada alternativa do predicado como uma frase, na ordem: as condições dela ligadas por "e". As
 * alternativas se combinam por OU; a lista vazia é o predicado sem condição.
 */
export function descreverAlternativas(
  condicoes: readonly CondicaoEmClausula[],
  fatosPorCodigo: ReadonlyMap<string, FatoEscolhivel>,
): readonly string[] {
  return clausulasDe(condicoes).map((clausula) =>
    clausula.condicoes
      .map(({ condicao }) => descreverCondicao(condicao, fatosPorCodigo.get(condicao.fato)))
      .join(' e '),
  );
}

function valorDescrito(condicao: CondicaoDeFato, fato: FatoEscolhivel): string {
  if (comparaComLista(condicao.operador)) {
    const valores = valoresDeListaDe(condicao);
    return valores.length > 0
      ? valores.map((valor) => rotuloDoValor(fato, valor)).join(', ')
      : '(valor não escolhido)';
  }

  const valor = valorEscalarDe(condicao);
  if (fato.tipoDominio === 'BOOLEANO') {
    if (valor === VALOR_VERDADEIRO) return 'sim';
    if (valor === VALOR_FALSO) return 'não';
  }
  return valor !== '' ? rotuloDoValor(fato, valor) : '(valor não escolhido)';
}
