import { Observable } from "rxjs";
import { inject, Injectable } from "@angular/core";
import { HttpClient, HttpContext, HttpHeaders, HttpParams } from "@angular/common/http";

import { components } from "./schema";
import { CONFIGURACAO_BASE_PATH } from "./tokens";
import { ApiResult, withVendorMime } from "@uniplus/shared-core/http";

export type TipoDeficienciaDto = components['schemas']['TipoDeficienciaDto'];
export type CriarTipoDeficienciaCommand = components['schemas']['CriarTipoDeficienciaCommand'];
export type AtualizarTipoDeficienciaCommand = components['schemas']['AtualizarTipoDeficienciaCommand'];

/** Filtro de listagem (cursor pagination, ADR-0026). */
export interface TipoDeficienciaQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

@Injectable({ providedIn: 'root' })
export class TipoDeficienciaApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** GET `/api/configuracao/tipos-deficiencia` — lista (vivas) por cursor. */
  listar(query: TipoDeficienciaQuery = {}): Observable<ApiResult<readonly TipoDeficienciaDto[]>> {
    let params = new HttpParams();
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
    } else {
      params = params.set('limit', String(query.limit ?? 100));
    }
    return this.http.get<ApiResult<readonly TipoDeficienciaDto[]>>(
      `${this.basePath}/api/configuracao/tipos-deficiencia`,
      { params, context: withVendorMime('tipo-deficiencia', 1) },
    );
  }

  /** GET `/api/configuracao/tipos-deficiencia{id}` — detalhe. */
  obter(id: string): Observable<ApiResult<TipoDeficienciaDto>> {
    return this.http.get<ApiResult<TipoDeficienciaDto>>(
      `${this.basePath}/api/configuracao//tipos-deficiencia/${encodeURIComponent(id)}`,
      { context: withVendorMime('tipo-deficiencia', 1) },
    );
  }

  /** POST `/api/configuracao/admin/tipos-deficiencia{` — cria. Idempotency-Key (ADR-0027). */
  criar(command: CriarTipoDeficienciaCommand, context: HttpContext): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(
      `${this.basePath}/api/configuracao/admin/tipos-deficiencia`,
      command,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /** PUT `/api/configuracao/admin/tipos-deficiencia/{id}` — atualiza. */
  atualizar(
    id: string,
    command: AtualizarTipoDeficienciaCommand,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/tipos-deficiencia/${encodeURIComponent(id)}`,
      command,
      { context },
    );
  }

  /** DELETE `/api/configuracao/tipos-deficiencia{/{id}` — soft-delete. */
  remover(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/tipos-deficiencia/${encodeURIComponent(id)}`,
    );
  }
}
