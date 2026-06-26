import { Observable } from 'rxjs';
import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { ApiResult } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type PesoAreaEnemDto = components['schemas']['PesoAreaEnemDto'];
export type CriarPesoAreaEnemCommand = components['schemas']['CriarPesoAreaEnemCommand'];
export type AtualizarPesoAreaEnemCommand = components['schemas']['AtualizarPesoAreaEnemCommand'];

export interface PesosAreaEnemQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

@Injectable({ providedIn: 'root' })
export class PesoEnemApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** GET `/api/peso-enem` — lista paginada por cursor (ADR-0026). */
  listar(query: PesosAreaEnemQuery = {}): Observable<ApiResult<readonly PesoAreaEnemDto[]>> {
    let params = new HttpParams();
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
    } else {
      params = params.set('limit', String(query.limit ?? 100));
    }
    return this.http.get<ApiResult<readonly PesoAreaEnemDto[]>>(
      `${this.basePath}/api/pesos-area-enem`,
      { params ,},
    );
  }

   /** POST `/api/admin/pesos-area-enem` — cria um peso area enem. Idempotency-Key obrigatório (ADR-0027). */
  criar(command: CriarPesoAreaEnemCommand, ctx: HttpContext): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(`${this.basePath}/api/admin/pesos-area-enem`, command, {
      context: ctx,
      headers: new HttpHeaders({ Accept: 'application/json' }),
    });
  }

  /** PUT `/api/admin/pesos-area-enem/{id}` — atualiza um Peso. */
  atualizar(id: string, command: AtualizarPesoAreaEnemCommand, ctx: HttpContext): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/admin/pesos-area-enem/${encodeURIComponent(id)}`,
      command,
      { context: ctx, },
    );
  }

  /** DELETE `/api/admin/pesos-area-enem/{id}` — remoção lógica (soft-delete). */
  remover(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.basePath}/api/admin/pesos-area-enem/${encodeURIComponent(id)}`,
    );
  }
}
