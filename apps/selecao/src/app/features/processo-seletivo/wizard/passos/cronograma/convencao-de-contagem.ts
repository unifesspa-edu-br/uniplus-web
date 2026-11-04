import type { RegraCatalogoDto } from '@uniplus/shared-data/selecao';

/**
 * Lê uma lista de textos publicada pelo catálogo — os invariantes de uma regra chegam como
 * JSON solto, e o contrato não promete a forma.
 *
 * Nada de inventar: o que não for texto dentro de um array é descartado em silêncio, e a
 * tela mostra o que sobrou. Uma lista vazia esconde a seção inteira, que é melhor do que
 * exibir um rótulo de seção sem nada embaixo.
 */
export function textosDoCatalogo(conteudo: unknown): readonly string[] {
  if (!Array.isArray(conteudo)) return [];
  return conteudo.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

/**
 * O que a convenção escolhida faz, na prosa que o próprio catálogo publica.
 *
 * O rótulo da opção trazia a base legal, e as três convenções de contagem têm a MESMA —
 * quatrocentos e sessenta e nove caracteres idênticos repetidos em cada linha, que não
 * distinguiam nada e ainda escondiam o fim do código. O que separa uma convenção da outra
 * são os invariantes: cada um descreve um caso — âncora fora da meia-noite, âncora em dia
 * não útil, contagem em dias úteis, contagem em horas — com o exemplo do resultado.
 */
export function invariantesDaConvencao(
  regras: readonly RegraCatalogoDto[],
  escolhida: string,
): readonly string[] {
  if (escolhida === '') return [];

  const regra = regras.find((item) => item.codigo === escolhida);
  return textosDoCatalogo(regra?.invariantes);
}

/** A base legal da convenção escolhida — a mesma das três, mostrada uma vez só. */
export function baseLegalDaConvencao(
  regras: readonly RegraCatalogoDto[],
  escolhida: string,
): string {
  if (escolhida === '') return '';

  return regras.find((item) => item.codigo === escolhida)?.baseLegal ?? '';
}

/** A convenção de contagem de prazo declarada, por código e versão. */
export function convencaoLida(codigo: string, versao: string): string | null {
  return codigo === '' ? null : `${codigo} · versão ${versao}`;
}
