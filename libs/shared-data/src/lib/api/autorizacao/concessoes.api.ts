import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import { PaginaQuery, paramsDaPagina } from './paginacao';
import type { components } from './schema';
import { AUTORIZACAO_BASE_PATH } from './tokens';

export type ConcessaoDto = components['schemas']['ConcessaoDto'];
export type EventoDaTrilhaDto = components['schemas']['EventoDaTrilhaDto'];
export type RevogarConcessaoRequest = components['schemas']['RevogarConcessaoRequest'];

/** Vocabulário do filtro de situação da API (`ativa` é o padrão do servidor). */
export type SituacaoDaConcessao = 'ativa' | 'revogada' | 'vencida' | 'todas';

export interface ConcessoesQuery extends PaginaQuery {
  readonly situacao?: SituacaoDaConcessao;
}

/** Cliente das concessões de acesso: consulta, trilha e revogação. */
@Injectable({ providedIn: 'root' })
export class ConcessoesApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);

  /** GET `/api/autorizacao/concessoes` — lista paginada por cursor. */
  listar(query: ConcessoesQuery = {}): Observable<ApiResult<readonly ConcessaoDto[]>> {
    return this.http.get<ApiResult<readonly ConcessaoDto[]>>(
      `${this.basePath}/api/autorizacao/concessoes`,
      {
        params: paramsDaPagina(query, { situacao: query.situacao }),
        context: withVendorMime('concessao', 1),
      },
    );
  }

  /** GET `/api/autorizacao/concessoes/{id}/trilha` — eventos em ordem cronológica. */
  trilha(id: string): Observable<ApiResult<readonly EventoDaTrilhaDto[]>> {
    return this.http.get<ApiResult<readonly EventoDaTrilhaDto[]>>(
      `${this.basePath}/api/autorizacao/concessoes/${encodeURIComponent(id)}/trilha`,
      { context: withVendorMime('trilha-da-concessao', 1) },
    );
  }

  /** POST `/api/autorizacao/concessoes/{id}/revogacao` — efeito imediato, sem aprovação. */
  revogar(
    id: string,
    request: RevogarConcessaoRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.post<ApiResult<void>>(
      `${this.basePath}/api/autorizacao/concessoes/${encodeURIComponent(id)}/revogacao`,
      request,
      { context },
    );
  }
}
