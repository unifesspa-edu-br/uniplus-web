import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type CampusDto = components['schemas']['CampusDto'];
export type CriarCampusCommand = components['schemas']['CriarCampusCommand'];
export type AtualizarCampusCommand = components['schemas']['AtualizarCampusCommand'];

/** Filtro de listagem de Campi (cursor pagination, ADR-0026). */
export interface CampiQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

/**
 * Cliente Angular standalone do recurso Campus (módulo Configuração). Os Campi
 * têm endereço estruturado como referência ao Geo (`endereco` aninhado + `cidade`
 * aninhada, ADR-0096).
 *
 * API thin (ADR-0013): tipos do `schema.ts` gerado; resposta envelopada em
 * `ApiResult<T>` (ADR-0011); versionamento por vendor MIME `campus v1`
 * (ADR-0016/0028). Espelha `InstituicaoApi`/`UnidadesApi`.
 */
@Injectable({ providedIn: 'root' })
export class CampiApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** GET `/api/campi` — lista paginada por cursor (ADR-0026). */
  listar(query: CampiQuery = {}): Observable<ApiResult<readonly CampusDto[]>> {
    let params = new HttpParams();
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
    } else {
      params = params.set('limit', String(query.limit ?? 100));
    }
    return this.http.get<ApiResult<readonly CampusDto[]>>(`${this.basePath}/api/campi`, {
      params,
      context: withVendorMime('campus', 1),
    });
  }

  /** GET `/api/campi/{id}` — detalhe de um Campus. */
  obter(id: string): Observable<ApiResult<CampusDto>> {
    return this.http.get<ApiResult<CampusDto>>(
      `${this.basePath}/api/campi/${encodeURIComponent(id)}`,
      { context: withVendorMime('campus', 1) },
    );
  }

  /** POST `/api/admin/campi` — cria um Campus. Idempotency-Key obrigatório (ADR-0027). */
  criar(command: CriarCampusCommand, context: HttpContext): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(`${this.basePath}/api/admin/campi`, command, {
      context,
      headers: new HttpHeaders({ Accept: 'application/json' }),
    });
  }

  /** PUT `/api/admin/campi/{id}` — atualiza um Campus. */
  atualizar(
    id: string,
    command: AtualizarCampusCommand,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/admin/campi/${encodeURIComponent(id)}`,
      command,
      { context },
    );
  }

  /** DELETE `/api/admin/campi/{id}` — remoção lógica (soft-delete). */
  remover(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.basePath}/api/admin/campi/${encodeURIComponent(id)}`,
    );
  }
}
