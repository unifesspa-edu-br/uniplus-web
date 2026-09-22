import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { SituacaoDoCertame } from './schema';
import { SELECAO_BASE_PATH } from './tokens';

export type CertameNaVitrineDto = components['schemas']['CertameNaVitrineDto'];
export { SituacaoDoCertame };
export type TipoCatalogadoCertameDto = components['schemas']['TipoCatalogadoCertameDto'];

/** Filtro da vitrine pública de certames (cursor opaco, ADR-0026). */
export interface CertamesPublicosQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
  readonly situacao?: SituacaoDoCertame;
  readonly q?: string;
  readonly incluirContadores?: boolean;
}

/**
 * Cliente da leitura pública de certames divulgados (ADR-0131/ADR-0133 da
 * `uniplus-api`) — o contrato que o portal do candidato lê para montar a
 * vitrine. Anônimo, sem escrita: a configuração do processo continua sendo
 * lida/escrita pelas rotas administrativas de `ProcessosSeletivosApi`.
 *
 * Vendor MIME `certame v1` (ADR-0028) — sem o header `Accept` correto a API
 * responde 406. Ordenação padrão do servidor é por urgência: quem ainda não
 * encerrou primeiro, do prazo mais próximo ao mais distante.
 */
@Injectable({ providedIn: 'root' })
export class CertamesPublicosApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(SELECAO_BASE_PATH);

  /** GET `/api/selecao/certames` — vitrine pública, paginada por cursor. */
  listar(
    query: CertamesPublicosQuery = {},
  ): Observable<ApiResult<readonly CertameNaVitrineDto[]>> {
    let params = new HttpParams();
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
    } else {
      params = params.set('limit', String(query.limit ?? 25));
    }
    if (query.situacao !== undefined) {
      params = params.set('situacao', query.situacao);
    }
    if (query.q !== undefined && query.q.trim().length > 0) {
      params = params.set('q', query.q.trim());
    }
    if (query.incluirContadores === true) {
      params = params.set('incluir_contadores', 'true');
    }

    return this.http.get<ApiResult<readonly CertameNaVitrineDto[]>>(
      `${this.basePath}/api/selecao/certames`,
      { params, context: withVendorMime('certame', 1) },
    );
  }
}
