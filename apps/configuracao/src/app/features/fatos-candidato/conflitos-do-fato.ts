import type { ProblemDetails } from '@uniplus/shared-core/http';

/** O código do fato já existe — ativo ou desativado: código de fato nunca se reutiliza. */
export const CODIGO_JA_EXISTE = 'uniplus.configuracao.fato_candidato.codigo_ja_existe';

/**
 * Os `code` com que a API diz que a escrita perdeu para outra: o global, o do fato do catálogo e
 * os da proteção de dados (conflito de versão e proteção que mudou depois de conferida). Os demais
 * 409 do fato são a duplicidade do código e o conflito de processamento da Idempotency-Key, que
 * não pedem releitura do fato.
 */
const CODIGOS_DE_CONCORRENCIA: readonly string[] = [
  'uniplus.concorrencia.conflito',
  'uniplus.configuracao.fato_candidato.conflito_de_concorrencia',
  'uniplus.configuracao.protecao_do_catalogo.conflito_de_concorrencia',
  'uniplus.configuracao.protecao_do_catalogo.protecao_mudou',
];

export function ehConflitoDeConcorrencia(
  problem: Pick<ProblemDetails, 'status' | 'code'>,
): boolean {
  return problem.status === 409 && CODIGOS_DE_CONCORRENCIA.includes(problem.code);
}
