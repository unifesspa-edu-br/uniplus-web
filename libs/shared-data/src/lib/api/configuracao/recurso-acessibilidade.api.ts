import { Observable } from "rxjs";
import { inject, Injectable } from "@angular/core";
import { HttpClient, HttpContext, HttpHeaders, HttpParams } from "@angular/common/http";

import { ApiResult, withVendorMime } from "@uniplus/shared-core/http";
import { components } from "./schema";
import { CONFIGURACAO_BASE_PATH } from "./tokens";

export type RecursoAcessibilidadeDto = components['schemas']['RecursoAcessibilidadeDto'];
export type CriarRecursoAcessibilidadeCommand = components['schemas']['CriarRecursoAcessibilidadeCommand'];
export type AtualizarRecursoAcessibilidadeCommand = components['schemas']['AtualizarRecursoAcessibilidadeCommand'];

/** Filtro de listagem (cursor pagination, ADR-0026). */
export interface RecursoAcessibilidadeQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

@Injectable({ providedIn: 'root' })
export class RecursoAcessibilidadeApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** GET `/api/configuracao/recursos-acessibilidade` — lista (vivas) por cursor. */
  listar(query: RecursoAcessibilidadeQuery = {}): Observable<ApiResult<readonly RecursoAcessibilidadeDto[]>> {
    let params = new HttpParams();
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
    } else {
      params = params.set('limit', String(query.limit ?? 100));
    }
    return this.http.get<ApiResult<readonly RecursoAcessibilidadeDto[]>>(
      `${this.basePath}/api/configuracao/recursos-acessibilidade`,
      { params, context: withVendorMime('recurso-acessibilidade', 1) },
    );
  }

  /** GET `/api/configuracao/recursos-acessibilidade{id}` — detalhe. */
  obter(id: string): Observable<ApiResult<RecursoAcessibilidadeDto>> {
    return this.http.get<ApiResult<RecursoAcessibilidadeDto>>(
      `${this.basePath}/api/configuracao/recursos-acessibilidade/${encodeURIComponent(id)}`,
      { context: withVendorMime('recurso-acessibilidade', 1) },
    );
  }

  /** POST `/api/configuracao/admin/recursos-acessibilidade{` — cria. Idempotency-Key (ADR-0027). */
  criar(command: CriarRecursoAcessibilidadeCommand, context: HttpContext): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(
      `${this.basePath}/api/configuracao/admin/recursos-acessibilidade`,
      command,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /** PUT `/api/configuracao/admin/recursos-acessibilidade/{id}` — atualiza. */
  atualizar(
    id: string,
    command: AtualizarRecursoAcessibilidadeCommand,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/recursos-acessibilidade/${encodeURIComponent(id)}`,
      command,
      { context },
    );
  }

  /** DELETE `/api/configuracao/recursos-acessibilidade{/{id}` — soft-delete. */
  remover(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/recursos-acessibilidade/{${encodeURIComponent(id)}`,
    );
  }
}
