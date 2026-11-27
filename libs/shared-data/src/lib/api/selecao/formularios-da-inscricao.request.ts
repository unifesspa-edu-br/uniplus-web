import { HttpResourceRequest } from '@angular/common/http';
import { withVendorMime } from '@uniplus/shared-core/http';

/**
 * Requisição dos formulários obrigatórios da fase de inscrição, na versão que a inscrição do candidato
 * fixou: `GET /api/selecao/processos-seletivos/{id}/inscricao/formularios`, em ordem do código. Entregue
 * como `HttpResourceRequest` porque a tela lê por signals (`useApiResource`, ADR-0018).
 */
export function formulariosDaInscricaoRequest(
  basePath: string,
  processoSeletivoId: string,
): HttpResourceRequest {
  return {
    url: `${basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/inscricao/formularios`,
    context: withVendorMime('formularios-inscricao', 1),
  };
}
