import { HttpResourceRequest } from '@angular/common/http';
import { withVendorMime } from '@uniplus/shared-core/http';

/**
 * Requisição do formulário da versão que a inscrição do candidato fixou ao nascer:
 * `GET /api/selecao/processos-seletivos/{id}/inscricao/formulario`. Entregue como
 * `HttpResourceRequest` porque a tela lê por signals (`useApiResource`, ADR-0018).
 */
export function formularioDaInscricaoRequest(
  basePath: string,
  processoSeletivoId: string,
): HttpResourceRequest {
  return {
    url: `${basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/inscricao/formulario`,
    context: withVendorMime('formulario-inscricao', 1),
  };
}
