import { Observable } from 'rxjs';
import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';

import { ApiResult, withVendorMime, janelaDaPagina } from '@uniplus/shared-core/http';
import { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type RecursoAcessibilidadeDto = components['schemas']['RecursoAcessibilidadeDto'];
export type CriarRecursoAcessibilidadeCommand =
  components['schemas']['CriarRecursoAcessibilidadeCommand'];
export type AtualizarRecursoAcessibilidadeCommand =
  components['schemas']['AtualizarRecursoAcessibilidadeCommand'];

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
  listar(
    query: RecursoAcessibilidadeQuery = {},
  ): Observable<ApiResult<readonly RecursoAcessibilidadeDto[]>> {
    return this.http.get<ApiResult<readonly RecursoAcessibilidadeDto[]>>(
      `${this.basePath}/api/configuracao/recursos-acessibilidade`,
      {
        params: janelaDaPagina(new HttpParams(), query),
        context: withVendorMime('recurso-acessibilidade', 1),
      },
    );
  }

  /** POST `/api/configuracao/admin/recursos-acessibilidade{` — cria. Idempotency-Key (ADR-0027). */
  criar(
    command: CriarRecursoAcessibilidadeCommand,
    context: HttpContext,
  ): Observable<ApiResult<string>> {
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
      `${this.basePath}/api/configuracao/admin/recursos-acessibilidade/${encodeURIComponent(id)}`,
    );
  }
}
