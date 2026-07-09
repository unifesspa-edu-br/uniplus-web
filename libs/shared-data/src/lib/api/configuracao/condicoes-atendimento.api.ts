import { Observable } from 'rxjs';
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';

import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type CondicaoAtendimentoDto = components['schemas']['CondicaoAtendimentoDto'];
export type CriarCondicaoAtendimentoCommand = components['schemas']['CriarCondicaoAtendimentoCommand'];
export type AtualizarCondicaoAtendimentoCommand = components['schemas']['AtualizarCondicaoAtendimentoCommand'];

/** Filtro de listagem (cursor pagination, ADR-0026). */
export interface CondicoesAtendimentoQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

@Injectable({ providedIn: 'root' })
export class CondicoesAtendimentoApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** GET `/api/configuracao/condicoes-atendimento` — lista (vivas) por cursor. */
  listar(query: CondicoesAtendimentoQuery = {}): Observable<ApiResult<readonly CondicaoAtendimentoDto[]>> {
    let params = new HttpParams();
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
    } else {
      params = params.set('limit', String(query.limit ?? 100));
    }
    return this.http.get<ApiResult<readonly CondicaoAtendimentoDto[]>>(
      `${this.basePath}/api/configuracao/condicoes-atendimento`,
      { params, context: withVendorMime('condicao-atendimento', 1) },
    );
  }

  /** GET `/api/configuracao/condicoes-atendimento{id}` — detalhe. */
  obter(id: string): Observable<ApiResult<CondicaoAtendimentoDto>> {
    return this.http.get<ApiResult<CondicaoAtendimentoDto>>(
      `${this.basePath}/api/configuracao/condicoes-atendimento${encodeURIComponent(id)}`,
      { context: withVendorMime('condicao-atendimento', 1) },
    );
  }

  /** POST `/api/configuracao/admin/condicoes-atendimento` — cria. Idempotency-Key (ADR-0027). */
  criar(command: CriarCondicaoAtendimentoCommand, context: HttpContext): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(
      `${this.basePath}/api/configuracao/admin/condicoes-atendimento`,
      command,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /** PUT `/api/configuracao/condicoes-atendimento/{id}` — atualiza. */
  atualizar(
    id: string,
    command: AtualizarCondicaoAtendimentoCommand,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/condicoes-atendimento/${encodeURIComponent(id)}`,
      command,
      { context },
    );
  }

  /** DELETE `/api/configuracao/condicoes-atendimento/{id}` — soft-delete. */
  remover(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/condicoes-atendimento/${encodeURIComponent(id)}`,
    );
  }
}
