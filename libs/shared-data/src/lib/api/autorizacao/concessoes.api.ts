import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { AUTORIZACAO_BASE_PATH } from './tokens';

export type ConcessaoDto = components['schemas']['ConcessaoDto'];
export type EventoDaTrilhaDto = components['schemas']['EventoDaTrilhaDto'];
export type RevogarConcessaoRequest = components['schemas']['RevogarConcessaoRequest'];

/** Vocabulário do filtro de situação da API (`ativa` é o padrão do servidor). */
export type SituacaoDaConcessao = 'ativa' | 'revogada' | 'vencida' | 'todas';

/** Cliente das concessões de acesso: revogação. */
@Injectable({ providedIn: 'root' })
export class ConcessoesApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);

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
