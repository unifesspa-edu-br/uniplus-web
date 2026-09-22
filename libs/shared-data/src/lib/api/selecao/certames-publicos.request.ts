import { HttpParams, HttpResourceRequest } from '@angular/common/http';
import { CursorPagina, cursorToString, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { SituacaoDoCertame } from './schema';

export type CertameNaVitrineDto = components['schemas']['CertameNaVitrineDto'];
export { SituacaoDoCertame };
export type TipoCatalogadoCertameDto = components['schemas']['TipoCatalogadoCertameDto'];

/** Caminho da vitrine pública, a partir do `SELECAO_BASE_PATH`. */
export const CERTAMES_PUBLICOS_PATH = '/api/selecao/certames';

/** Janela pedida quando a consulta não declara `limit`. */
const LIMIT_PADRAO = 10;

/** Consulta da vitrine pública de certames divulgados. */
export interface CertamesPublicosQuery {
  /** Página de navegação; ausente é a primeira (ADR-0026). */
  readonly pagina?: CursorPagina;
  readonly situacao?: string | null;
  readonly q?: string;
  readonly limit?: number;
  readonly incluirContadores?: boolean;
}

/**
 * Requisição da leitura pública de certames divulgados (ADR-0131/ADR-0133 da
 * `uniplus-api`) — o contrato que o portal do candidato lê para montar a
 * vitrine. Anônima, sem escrita: a configuração do processo continua sendo
 * lida/escrita pelas rotas administrativas de `ProcessosSeletivosApi`.
 *
 * Entregue como `HttpResourceRequest` porque a vitrine é um GET reativo por
 * signals, que o `useApiResource` (ADR-0018) consome direto — e assim URL,
 * parâmetros e vendor MIME têm uma definição só, aqui, em vez de serem
 * remontados em cada página que consultar a vitrine.
 *
 * Vendor MIME `certame v1` (ADR-0016/0028) — sem o header `Accept` correto a
 * API responde 406. A ordenação padrão do servidor é por urgência: quem ainda
 * não encerrou primeiro, do prazo mais próximo ao mais distante.
 */
export function certamesPublicosRequest(
  basePath: string,
  query: CertamesPublicosQuery = {},
): HttpResourceRequest {
  return {
    url: `${basePath}${CERTAMES_PUBLICOS_PATH}`,
    params: certamesPublicosParams(query),
    context: withVendorMime('certame', 1),
  };
}

function certamesPublicosParams(query: CertamesPublicosQuery): HttpParams {
  let params = new HttpParams();

  if (query.incluirContadores === true) {
    params = params.set('incluir_contadores', 'true');
  }
  if (query.situacao) {
    params = params.set('situacao', query.situacao);
  }
  const q = query.q?.trim() ?? '';
  if (q.length > 0) {
    params = params.set('q', q);
  }

  // `cursor` e `limit` são exclusivos: o cursor opaco já carrega a janela e o
  // recorte da consulta que o emitiu, e repetir `limit` ao navegar renderia
  // 422 (uniplus.pagination.limit_invalido).
  return query.pagina === undefined
    ? params.set('limit', String(query.limit ?? LIMIT_PADRAO))
    : params
        .set('cursor', cursorToString(query.pagina.cursor))
        .set('direction', query.pagina.direction);
}
