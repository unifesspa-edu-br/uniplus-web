import { HttpContext, HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { SELECAO_BASE_PATH } from './tokens';

export type ObrigatoriedadeLegalDto = components['schemas']['ObrigatoriedadeLegalDto'];
export type CriarObrigatoriedadeLegalCommand =
  components['schemas']['CriarObrigatoriedadeLegalCommand'];
export type AtualizarObrigatoriedadeLegalCommand =
  components['schemas']['AtualizarObrigatoriedadeLegalCommand'];
export type CategoriaObrigatoriedade = components['schemas']['CategoriaObrigatoriedade'];

/** Filtro de listagem de obrigatoriedades legais (cursor pagination, ADR-0026). */
export interface ObrigatoriedadesLegaisQuery {
  readonly tipoEdital?: string;
  readonly categoria?: CategoriaObrigatoriedade;
  readonly vigentes?: boolean;
  readonly cursor?: string;
  readonly limit?: number;
  readonly direction?: 'next' | 'prev';
}

/**
 * Cliente Angular standalone do recurso Obrigatoriedade Legal do módulo
 * Seleção.
 *
 * API thin (ADR-0013): tipos vindos do `schema.ts` gerado por
 * openapi-typescript; resposta envelopada em `ApiResult<T>` (ADR-0011);
 * versionamento por vendor MIME `obrigatoriedade-legal v1` (ADR-0016/0028);
 * paginação por cursor opaco (ADR-0026) e Idempotency-Key em comandos
 * mutáveis (ADR-0027).
 *
 * Desacoplado do app: recibos de `SELECAO_BASE_PATH` via DI e depende apenas
 * de `@uniplus/shared-core/http` — consumível por qualquer feature do módulo.
 */
@Injectable({ providedIn: 'root' })
export class ObrigatoriedadesLegaisApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(SELECAO_BASE_PATH);

  /** GET `/api/selecao/obrigatoriedades-legais` — lista paginada por cursor (ADR-0026). */
  listar(
    query: ObrigatoriedadesLegaisQuery = {},
  ): Observable<ApiResult<readonly ObrigatoriedadeLegalDto[]>> {
    let params = new HttpParams();
    if (query.tipoEdital !== undefined) params = params.set('tipoEdital', query.tipoEdital);
    if (query.categoria !== undefined) params = params.set('categoria', query.categoria);
    if (query.vigentes !== undefined) params = params.set('vigentes', String(query.vigentes));

    if (query.cursor !== undefined && query.cursor.length > 0) {
      params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
    } else {
      params = params.set('limit', String(query.limit ?? 100));
    }

    return this.http.get<ApiResult<readonly ObrigatoriedadeLegalDto[]>>(
      `${this.basePath}/api/selecao/obrigatoriedades-legais`,
      { params, context: withVendorMime('obrigatoriedade-legal', 1) },
    );
  }

  /** GET `/api/selecao/obrigatoriedades-legais/{id}` — detalhe da obrigatoriedade legal. */
  obter(id: string): Observable<ApiResult<ObrigatoriedadeLegalDto>> {
    return this.http.get<ApiResult<ObrigatoriedadeLegalDto>>(
      `${this.basePath}/api/selecao/obrigatoriedades-legais/${encodeURIComponent(id)}`,
      { context: withVendorMime('obrigatoriedade-legal', 1) },
    );
  }

  /** POST `/api/selecao/admin/obrigatoriedades-legais` — cria. Idempotency-Key obrigatório (ADR-0027). */
  criar(
    command: CriarObrigatoriedadeLegalCommand,
    context: HttpContext,
  ): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(
      `${this.basePath}/api/selecao/admin/obrigatoriedades-legais`,
      command,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /** PUT `/api/selecao/admin/obrigatoriedades-legais/{id}` — atualiza. Idempotency-Key obrigatório (ADR-0027). */
  atualizar(
    id: string,
    command: AtualizarObrigatoriedadeLegalCommand,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/selecao/admin/obrigatoriedades-legais/${encodeURIComponent(id)}`,
      command,
      { context },
    );
  }

  /** DELETE `/api/selecao/admin/obrigatoriedades-legais/{id}` — inativação (soft-delete). */
  remover(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.basePath}/api/selecao/admin/obrigatoriedades-legais/${encodeURIComponent(id)}`,
    );
  }
}
