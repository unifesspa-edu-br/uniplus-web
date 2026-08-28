import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { SELECAO_BASE_PATH } from './tokens';

export type RegraCatalogoDto = components['schemas']['RegraCatalogoDto'];

/** Filtro de listagem do catálogo de regras (cursor pagination, ADR-0026). */
export interface RegrasCatalogoQuery {
  readonly tipo?: string;
  readonly cursor?: string;
  readonly limit?: number;
  readonly direction?: 'next' | 'prev';
}

/**
 * Cliente Angular standalone do catálogo de regras versionadas do módulo
 * Seleção.
 *
 * Uma regra é identificada por código **e** versão, e é assim que a
 * distribuição de vagas a referencia: o processo guarda o par, não um id, de
 * modo que publicar uma versão nova do catálogo não muda a regra que um
 * processo já publicado aplicou.
 *
 * API thin (ADR-0013): tipos vindos do `schema.ts` gerado por
 * openapi-typescript; resposta envelopada em `ApiResult<T>` (ADR-0011);
 * versionamento por vendor MIME `regra-catalogo v1` (ADR-0016/0028);
 * paginação por cursor opaco (ADR-0026).
 */
@Injectable({ providedIn: 'root' })
export class RegrasCatalogoApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(SELECAO_BASE_PATH);

  /** GET `/api/selecao/regras-catalogo` — lista paginada por cursor (ADR-0026). */
  listar(query: RegrasCatalogoQuery = {}): Observable<ApiResult<readonly RegraCatalogoDto[]>> {
    let params = new HttpParams();
    // O filtro entra antes do ramo de paginação: navegar por cursor não pode
    // devolver o catálogo inteiro.
    if (query.tipo !== undefined) params = params.set('tipo', query.tipo);

    if (query.cursor !== undefined && query.cursor.length > 0) {
      params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
    } else {
      params = params.set('limit', String(query.limit ?? 100));
    }

    return this.http.get<ApiResult<readonly RegraCatalogoDto[]>>(
      `${this.basePath}/api/selecao/regras-catalogo`,
      { params, context: withVendorMime('regra-catalogo', 1) },
    );
  }

  /**
   * GET `/api/selecao/regras-catalogo/{codigo}/versoes/{versao}` — uma versão
   * específica, que é a granularidade em que a regra é referenciada.
   */
  obterVersao(codigo: string, versao: string): Observable<ApiResult<RegraCatalogoDto>> {
    return this.http.get<ApiResult<RegraCatalogoDto>>(
      `${this.basePath}/api/selecao/regras-catalogo/${encodeURIComponent(codigo)}/versoes/${encodeURIComponent(versao)}`,
      { context: withVendorMime('regra-catalogo', 1) },
    );
  }
}
