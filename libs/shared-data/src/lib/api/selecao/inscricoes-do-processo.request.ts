import { HttpParams, HttpResourceRequest } from '@angular/common/http';
import { withVendorMime } from '@uniplus/shared-core/http';

/** Janela da listagem: primeira página pelo `limit`, as seguintes pelo cursor do header `Link`. */
export interface InscricoesDoProcessoQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

/**
 * Requisição da listagem das inscrições enviadas de um processo, na visão de quem o opera:
 * `GET /api/selecao/processos-seletivos/{id}/inscricoes`, paginada por cursor opaco. A decisão de
 * acesso e o que sai em cada linha são da API.
 *
 * Entregue como `HttpResourceRequest` porque a tela lê por signals (`useApiResource`, ADR-0018).
 * Com cursor, o `limit` não viaja: o cursor já carrega a janela.
 */
export function inscricoesDoProcessoRequest(
  basePath: string,
  processoSeletivoId: string,
  query: InscricoesDoProcessoQuery = {},
): HttpResourceRequest {
  let params = new HttpParams();
  if (query.cursor !== undefined) {
    params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
  } else if (query.limit !== undefined) {
    params = params.set('limit', String(query.limit));
  }

  return {
    url: `${basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/inscricoes`,
    params,
    context: withVendorMime('inscricao-do-processo', 1),
  };
}
