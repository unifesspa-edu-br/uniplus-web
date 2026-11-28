import type { ProblemValidationError } from '@uniplus/shared-core/http';

export const PREFIXO_DA_RECUSA = 'uniplus.selecao.configuracao_classificacao.';

/**
 * A mensagem que o servidor deu para a causa, como veio; o texto genérico só quando ela não veio.
 */
export function mensagemDaApiOu(
  erro: Pick<ProblemValidationError, 'message'>,
  textoGenerico: string,
): string {
  return erro.message?.trim() ? erro.message : textoGenerico;
}

export function mensagemDaRecusaDaEscala(erro: Pick<ProblemValidationError, 'message'>): string {
  return mensagemDaApiOu(
    erro,
    'O servidor recusou a escala da nota final. Confira o valor informado.',
  );
}

export function mensagemDaRecusaDaResolucao(erro: Pick<ProblemValidationError, 'message'>): string {
  return mensagemDaApiOu(
    erro,
    'O servidor recusou a resolução de Peso por Área escolhida. Confira o cadastro de Peso por Área ou escolha outra.',
  );
}
