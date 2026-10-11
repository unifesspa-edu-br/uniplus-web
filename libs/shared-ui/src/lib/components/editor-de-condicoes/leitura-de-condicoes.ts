/**
 * A leitura em prosa do que o editor escreve, para quem confere a regra sem abrir o editor: o
 * nome do fato, a comparação como o editor a oferece e o valor pela descrição do cadastro.
 */

import {
  VALOR_FALSO,
  VALOR_VERDADEIRO,
  clausulasDe,
  comparaComLista,
  fatoEscolhivel,
  operadoresDoFato,
  rotuloDoValor,
  valorEscalarDe,
  valoresDeListaDe,
  type CondicaoDeFato,
  type CondicaoEmClausula,
  type FatoDoCatalogo,
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

/** Todo fato do catálogo pelo código, para ler a regra salva mesmo quando ela cita fato que o editor não oferece. */
export function fatosParaLeitura(
  catalogo: readonly FatoDoCatalogo[],
): ReadonlyMap<string, FatoEscolhivel> {
  const porCodigo = new Map<string, FatoEscolhivel>();
  for (const view of catalogo) {
    const fato = fatoEscolhivel(view);
    if (fato !== null) porCodigo.set(fato.codigo, fato);
  }
  return porCodigo;
}

/** A leitura da regra sem condição: a modalidade vale para todo candidato. */
export const TODOS_OS_CANDIDATOS = 'Todos os candidatos';

/** A leitura da regra com condição quando o catálogo de fatos não está à mão para nomeá-las. */
export const QUEM_ATENDE_AS_CONDICOES = 'Quem atende às condições da regra';

/**
 * A regra numa linha: a regra sem condição vale para todos; as alternativas se ligam por "ou".
 * Sem o catálogo, a regra com condição não se lê pelos nomes dos fatos, e a linha diz só que ela
 * existe.
 */
export function resumoDaRegra(
  regra: readonly CondicaoEmClausula[],
  fatos: ReadonlyMap<string, FatoEscolhivel> | null,
): string {
  if (fatos === null && regra.length > 0) return QUEM_ATENDE_AS_CONDICOES;
  const alternativas = descreverAlternativas(regra, fatos ?? new Map());
  return alternativas.length === 0 ? TODOS_OS_CANDIDATOS : alternativas.join('; ou ');
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
