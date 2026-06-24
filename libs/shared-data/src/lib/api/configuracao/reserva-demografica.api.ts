import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type ReferenciaReservaDemograficaDto =
  components['schemas']['ReferenciaReservaDemograficaDto'];
export type CriarReferenciaReservaDemograficaCommand =
  components['schemas']['CriarReferenciaReservaDemograficaCommand'];
export type AtualizarReferenciaReservaDemograficaCommand =
  components['schemas']['AtualizarReferenciaReservaDemograficaCommand'];

/** Filtro de listagem (cursor pagination, ADR-0026). */
export interface ReservaDemograficaQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

/**
 * Cliente Angular standalone do recurso Referência de reserva demográfica
 * (módulo Configuração). Entidade flat (sem FK) que congela, por Censo do IBGE,
 * os percentuais que dimensionam as sub-reservas da Lei 12.711/2012.
 *
 * API thin (ADR-0013): tipos do `schema.ts`; resposta envelopada em
 * `ApiResult<T>` (ADR-0011); vendor MIME `referencia-reserva-demografica v1`
 * (ADR-0016/0028). **O GET lista apenas referências ativas** — soft-delete
 * (ADR-0055) não é listável; não há campo de status nem parâmetro para inativas.
 */
@Injectable({ providedIn: 'root' })
export class ReservaDemograficaApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** GET `/api/referencias-reserva-demografica` — lista (ativas) por cursor. */
  listar(
    query: ReservaDemograficaQuery = {},
  ): Observable<ApiResult<readonly ReferenciaReservaDemograficaDto[]>> {
    let params = new HttpParams();
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
    } else {
      params = params.set('limit', String(query.limit ?? 100));
    }
    return this.http.get<ApiResult<readonly ReferenciaReservaDemograficaDto[]>>(
      `${this.basePath}/api/referencias-reserva-demografica`,
      { params, context: withVendorMime('referencia-reserva-demografica', 1) },
    );
  }

  /** GET `/api/referencias-reserva-demografica/{id}` — detalhe. */
  obter(id: string): Observable<ApiResult<ReferenciaReservaDemograficaDto>> {
    return this.http.get<ApiResult<ReferenciaReservaDemograficaDto>>(
      `${this.basePath}/api/referencias-reserva-demografica/${encodeURIComponent(id)}`,
      { context: withVendorMime('referencia-reserva-demografica', 1) },
    );
  }

  /** POST `/api/admin/referencias-reserva-demografica` — cria. Idempotency-Key (ADR-0027). */
  criar(
    command: CriarReferenciaReservaDemograficaCommand,
    context: HttpContext,
  ): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(
      `${this.basePath}/api/admin/referencias-reserva-demografica`,
      command,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /** PUT `/api/admin/referencias-reserva-demografica/{id}` — atualiza. */
  atualizar(
    id: string,
    command: AtualizarReferenciaReservaDemograficaCommand,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/admin/referencias-reserva-demografica/${encodeURIComponent(id)}`,
      command,
      { context },
    );
  }

  /** DELETE `/api/admin/referencias-reserva-demografica/{id}` — soft-delete. */
  remover(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.basePath}/api/admin/referencias-reserva-demografica/${encodeURIComponent(id)}`,
    );
  }
}
