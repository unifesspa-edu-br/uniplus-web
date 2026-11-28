import { STATUS_HTTP } from '@uniplus/shared-core/http';

import type { MotivoFalhaDeLeitura } from '../wizard/processo-seletivo.models';

/**
 * 404 e 403 descrevem o endereço, não uma indisponibilidade: repetir a leitura daria o mesmo
 * resultado, e a saída é voltar à listagem. O resto admite retentativa.
 */
export function motivoDaFalhaDeLeitura(status: number): MotivoFalhaDeLeitura {
  if (status === STATUS_HTTP.NAO_ENCONTRADO) return 'naoEncontrado';
  if (status === STATUS_HTTP.SEM_PERMISSAO || status === STATUS_HTTP.NAO_AUTENTICADO) {
    return 'semPermissao';
  }
  return 'falhaTemporaria';
}
