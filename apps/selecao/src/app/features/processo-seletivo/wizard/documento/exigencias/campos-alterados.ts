import { mesmoConteudo } from '../../shared/conteudo-canonico';

/** Como um campo do editor volta ao documento. */
export interface Aplicacao<D, E, C> {
  readonly campo: keyof E;
  readonly aplicar: (documento: D, atual: E, contexto: C) => D;
}

/** O que a tela tem de uma parte, o que ela leu dela e o contexto em que a converte. */
export interface Mudanca<E, C> {
  readonly atual: E;
  readonly lido: Partial<E>;
  readonly contexto: C;
}

/**
 * O documento com só os campos que a tela mudou em relação ao que ela leu dele. O campo que
 * ninguém mexeu não é reescrito, então a parte intacta volta como o mesmo objeto, com os campos que
 * a tela não conhece.
 */
export function comCamposAlterados<D, E, C>(
  original: D,
  { atual, lido, contexto }: Mudanca<E, C>,
  aplicacoes: readonly Aplicacao<D, E, C>[],
): D {
  return aplicacoes
    .filter(({ campo }) => !mesmoConteudo(atual[campo], lido[campo]))
    .reduce((documento, { aplicar }) => aplicar(documento, atual, contexto), original);
}

/** A mesma lista original quando os itens novos são, um a um, os originais. */
export function preservandoOriginal<T>(
  original: readonly T[] | undefined,
  itens: readonly T[],
): readonly T[] {
  const intacta =
    original !== undefined &&
    original.length === itens.length &&
    itens.every((item, posicao) => item === original[posicao]);
  return intacta ? original : itens;
}

/**
 * A lista do documento para a lista que a tela tem, posição por posição: o item que a tela não
 * mudou volta como o objeto original.
 */
export function itensPreservados<D, E>(
  originais: readonly D[] | undefined,
  atuais: readonly E[],
  noEditor: (original: D) => E,
  noDocumento: (atual: E, original: D | undefined) => D,
): D[] {
  return atuais.map((atual, posicao) => {
    const original = originais?.[posicao];
    const intacto = original !== undefined && mesmoConteudo(noEditor(original), atual);
    return intacto ? original : noDocumento(atual, original);
  });
}

/** O código que o documento leva: texto vazio ou `null` na tela é campo ausente no documento. */
export function codigoOuAusente<T extends string>(texto: string | null): T | undefined {
  return texto === null || texto === '' ? undefined : (texto as T);
}

/** O código que a tela guarda como texto, no tipo fechado que o documento usa. */
export function comoCodigo<T extends string>(texto: string): T {
  return texto as T;
}
