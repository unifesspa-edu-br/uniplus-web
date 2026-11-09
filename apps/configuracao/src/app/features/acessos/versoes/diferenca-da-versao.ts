export interface DiferencaDaVersao {
  readonly acrescimo: readonly string[];
  readonly remocao: readonly string[];
}

export type MudancaDaPermissao = 'acrescentada' | 'removida' | null;

/** O que a proposta acrescenta e retira em relação ao que está em vigor, em ordem alfabética. */
export function diferencaDaVersao(
  emVigor: readonly string[],
  proposta: ReadonlySet<string>,
): DiferencaDaVersao {
  const vigentes = new Set(emVigor);
  return {
    acrescimo: [...proposta].filter((codigo) => !vigentes.has(codigo)).sort(),
    remocao: emVigor.filter((codigo) => !proposta.has(codigo)).sort(),
  };
}

export function mudancaDaPermissao(codigo: string, diferenca: DiferencaDaVersao): MudancaDaPermissao {
  if (diferenca.acrescimo.includes(codigo)) return 'acrescentada';
  return diferenca.remocao.includes(codigo) ? 'removida' : null;
}

/**
 * Para onde a proposta vai: acréscimo, texto ou documento novos pedem versão pendente (com a remoção junto, se
 * houver); só retirada vale na hora e dispensa o documento; sem mudança nada se envia.
 */
export type DestinoDaProposta = 'versao' | 'remocao' | 'nada';

export function destinoDaProposta(diferenca: DiferencaDaVersao, conteudoMudou: boolean): DestinoDaProposta {
  if (diferenca.acrescimo.length > 0 || conteudoMudou) return 'versao';
  return diferenca.remocao.length > 0 ? 'remocao' : 'nada';
}
