import {
  paginaDoProblema,
  type ApiFailure,
  type ProblemI18nService,
} from '@uniplus/shared-core/http';
import type { RecusaDoCampo } from '@uniplus/shared-ui/components';

const JA_ESCOLHIDO = 'uniplus.selecao.motivo_de_decisao.ja_escolhido';
const NAO_ESCOLHIDO = 'uniplus.selecao.motivo_de_decisao.nao_escolhido';
const PROCESSO_OCUPADO = 503;

/**
 * O que a tela faz com a recusa de uma escolha de motivo: o motivo já estava como a pessoa pediu e
 * nada há a dizer, o servidor estava ocupado e vale pedir de novo, ou a recusa é mostrada.
 */
export type DesfechoDaRecusa = 'ja-estava-como-pedido' | 'tentar-de-novo' | 'mostrar';

export function desfechoDaRecusa(falha: ApiFailure): DesfechoDaRecusa {
  if (falha.problem.code === JA_ESCOLHIDO || falha.problem.code === NAO_ESCOLHIDO) {
    return 'ja-estava-como-pedido';
  }
  return falha.problem.status === PROCESSO_OCUPADO ? 'tentar-de-novo' : 'mostrar';
}

/** A recusa como a seção a mostra: a mensagem da API, o código e a página que o explica. */
export function recusaDaEscolha(falha: ApiFailure, textos: ProblemI18nService): RecusaDoCampo {
  return {
    codigo: falha.problem.code,
    mensagem: textos.resolve(falha.problem).title,
    pagina: paginaDoProblema(falha.problem),
  };
}
