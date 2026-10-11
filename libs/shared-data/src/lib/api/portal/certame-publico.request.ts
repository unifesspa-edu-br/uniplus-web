import { HttpResourceRequest } from '@angular/common/http';
import { withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';

export type CertamePublicoResponse = components['schemas']['CertamePublicoResponse'];
export type EventoDaLinhaDoTempoResponse = components['schemas']['EventoDaLinhaDoTempoResponse'];

/**
 * Requisição da página pública do certame (uniplus-api#1498): o certame com a linha do tempo dos
 * atos publicados, cada um com o endereço do PDF no acervo público quando houver. Anônima.
 * Vendor MIME `certame-publico v1` — sem o `Accept` correto a API responde 406.
 */
export function certamePublicoDoPortalRequest(
  basePath: string,
  identificador: string,
): HttpResourceRequest {
  return {
    url: `${basePath}/api/portal/certames/${encodeURIComponent(identificador)}`,
    context: withVendorMime('certame-publico', 1),
  };
}
