import { STATUS_HTTP, ehRecusaDefinitiva, type ProblemDetails } from '@uniplus/shared-core/http';

/** A leitura recusada em definitivo, com o texto que a tela mostra e o status que a explica. */
export interface RecusaDaLeitura {
  readonly texto: string;
  readonly status: number;
}

/** A recusa definitiva do problema, ou `null` quando a leitura não foi recusada em definitivo. */
export function recusaDe(
  problema: ProblemDetails | null | undefined,
  texto: string,
): RecusaDaLeitura | null {
  return problema && ehRecusaDefinitiva(problema) ? { texto, status: problema.status } : null;
}

/**
 * O título diz o que houve com a leitura. Só o 404 tem título do recurso: o 401 e o 403 saem da
 * tela para o login e para o acesso negado, mas a resposta chega antes e o título também precisa
 * ser verdadeiro nesse instante.
 */
export function tituloDaRecusa(status: number, naoEncontrado: string): string {
  if (status === STATUS_HTTP.NAO_AUTENTICADO) return 'Sessão encerrada';
  if (status === STATUS_HTTP.SEM_PERMISSAO) return 'Acesso negado';
  return naoEncontrado;
}
