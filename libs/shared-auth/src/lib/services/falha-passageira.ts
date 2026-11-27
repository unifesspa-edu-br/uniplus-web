import type { ApiFailure } from '@uniplus/shared-core/http';

/**
 * Queda do servidor ou da conexão (status 0 ou 5xx): a consulta pode dar certo na tentativa
 * seguinte. Qualquer outra recusa, como 401 ou 403, é resposta da API e vale como resposta.
 */
export function ehFalhaPassageira(falha: ApiFailure): boolean {
  return falha.status === 0 || falha.status >= 500;
}
