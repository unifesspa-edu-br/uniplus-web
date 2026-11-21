/** Uma opção que o vocabulário oferece: o código que se grava e o rótulo que se lê. */
export interface OpcaoDoVocabulario {
  readonly codigo: string;
  readonly rotulo: string;
}

/**
 * Uma opção da escolha. `foraDoVocabulario` marca o valor já gravado que o vocabulário não oferece
 * mais: ele segue à vista e marcado, para que a tela não mostre outra escolha no lugar dele.
 */
export interface OpcaoDeEscolha extends OpcaoDoVocabulario {
  readonly foraDoVocabulario: boolean;
}

/**
 * As opções que a pessoa vê: as do vocabulário e, se o valor atual não está entre elas, o próprio
 * valor, marcado como fora do vocabulário. Sem valor atual, só as do vocabulário.
 */
export function opcoesParaEscolha(
  opcoes: readonly OpcaoDoVocabulario[],
  valorAtual: string,
): readonly OpcaoDeEscolha[] {
  const oferecidas = opcoes.map((opcao) => ({ ...opcao, foraDoVocabulario: false }));
  const oferecida = valorAtual === '' || opcoes.some((opcao) => opcao.codigo === valorAtual);
  if (oferecida) return oferecidas;
  return [...oferecidas, { codigo: valorAtual, rotulo: valorAtual, foraDoVocabulario: true }];
}
