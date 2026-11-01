import { HttpResourceRequest } from '@angular/common/http';
import { withVendorMime } from '@uniplus/shared-core/http';

/** `…/processos-seletivos/{id}/inscricoes/{inscricaoId}`: a rota da inscrição de um processo. */
export function inscricaoDoProcessoUrl(
  basePath: string,
  processoSeletivoId: string,
  inscricaoId: string,
): string {
  return `${basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/inscricoes/${encodeURIComponent(inscricaoId)}`;
}

/**
 * Requisição do detalhe de uma inscrição enviada, na visão de quem opera o processo:
 * `GET /api/selecao/processos-seletivos/{id}/inscricoes/{inscricaoId}`. O que sai em cada item é
 * decisão da API.
 *
 * Entregue como `HttpResourceRequest` porque a tela lê por signals (`useApiResource`, ADR-0018).
 */
export function inscricaoAdministrativaRequest(
  basePath: string,
  processoSeletivoId: string,
  inscricaoId: string,
): HttpResourceRequest {
  return {
    url: inscricaoDoProcessoUrl(basePath, processoSeletivoId, inscricaoId),
    context: withVendorMime('inscricao-administrativa', 1),
  };
}
