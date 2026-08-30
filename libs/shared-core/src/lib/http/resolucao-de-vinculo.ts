import { LookupCompleto } from './lookup-completo';

/**
 * Desfecho da tentativa de trocar uma chave estrangeira pelo rótulo que a
 * descreve.
 *
 * Os três desfechos que não resolvem têm causas distintas e pedem reações
 * distintas de quem está na tela — esperar, tentar de novo, ou procurar o
 * vínculo no cadastro de origem. Um fallback único para os três esconde a
 * diferença e faz falha de rede parecer dado legítimo (#579).
 */
export type EstadoDoVinculo =
  /** O item foi encontrado no catálogo e o rótulo está pronto. */
  | 'resolvido'
  /** O catálogo ainda não chegou — a busca está em curso ou prestes a começar. */
  | 'carregando'
  /** A busca do catálogo foi recusada; nova tentativa pode resolver. */
  | 'falhou'
  /** O catálogo chegou inteiro e o id não está nele. */
  | 'ausente';

export interface ResolucaoDeVinculo {
  readonly estado: EstadoDoVinculo;
  /** Rótulo pronto para exibição. Vazio fora do estado `resolvido`. */
  readonly rotulo: string;
}

/**
 * Classifica a resolução de uma chave estrangeira a partir do estado do
 * catálogo que a resolveria.
 *
 * O item encontrado ganha de qualquer outro estado: `lookupCompleto` preserva
 * as opções da última busca bem-sucedida, então uma nova tentativa em curso —
 * ou recusada — não é motivo para apagar da tela o rótulo que já estava certo.
 *
 * @param lookup Catálogo consultado para resolver o vínculo.
 * @param item Item correspondente ao id, ou `undefined` se não houver.
 * @param rotular Monta o texto exibido a partir do item encontrado.
 */
export function resolverVinculo<T>(
  lookup: Pick<LookupCompleto<T>, 'comErro' | 'pendente'>,
  item: T | undefined,
  rotular: (item: T) => string,
): ResolucaoDeVinculo {
  if (item !== undefined) {
    return { estado: 'resolvido', rotulo: rotular(item) };
  }
  if (lookup.comErro()) {
    return { estado: 'falhou', rotulo: '' };
  }
  if (lookup.pendente()) {
    return { estado: 'carregando', rotulo: '' };
  }
  return { estado: 'ausente', rotulo: '' };
}
