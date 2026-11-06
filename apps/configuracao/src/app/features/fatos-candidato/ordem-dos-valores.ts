/** A nova ordem de um valor trocado com o vizinho, e o botão que recebe o foco depois. */
export interface TrocaDeLugar {
  readonly codigos: readonly string[];
  readonly focoEm: 'subir' | 'descer';
}

/**
 * Troca o valor de lugar com o vizinho e devolve a lista completa — a API exige todos os códigos,
 * desativados inclusive, porque a ordem é do fato e não só do que aparece para o candidato.
 * Chegando à ponta, o botão que moveu fica desabilitado: o foco vai para o oposto, que continua
 * valendo.
 */
export function trocarDeLugar(
  codigos: readonly string[],
  codigo: string,
  sentido: -1 | 1,
): TrocaDeLugar | null {
  const de = codigos.indexOf(codigo);
  const para = de + sentido;
  if (de < 0 || para < 0 || para >= codigos.length) return null;
  const trocados = [...codigos];
  [trocados[de], trocados[para]] = [trocados[para], trocados[de]];
  const naPonta = para === 0 || para === codigos.length - 1;
  const subindo = sentido === -1;
  return { codigos: trocados, focoEm: subindo !== naPonta ? 'subir' : 'descer' };
}
