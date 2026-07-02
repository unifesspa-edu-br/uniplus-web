import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type PesoAreaEnemDto = components['schemas']['PesoAreaEnemDto'];
export type CriarPesoAreaEnemCommand = components['schemas']['CriarPesoAreaEnemCommand'];
export type AtualizarPesoAreaEnemCommand = components['schemas']['AtualizarPesoAreaEnemCommand'];

/** Filtro de listagem (cursor pagination, ADR-0026). */
export interface PesosAreaEnemQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

/**
 * Cliente Angular standalone do recurso Peso do ENEM por grupo de curso
 * (módulo Configuração). Cada resolução materializa quatro linhas (uma por
 * grupo de área); não há endpoint de lote — a coordenação das 4 linhas é
 * responsabilidade da página (issue #395 §6.2).
 *
 * API thin (ADR-0013): tipos do `schema.ts`; resposta envelopada em
 * `ApiResult<T>` (ADR-0011); vendor MIME `peso-area-enem v1` (ADR-0016 —
 * `pesos-enem` resultaria em 406 Not Acceptable). Paths prefixados pelo
 * módulo `configuracao` no gateway (ADR-0064). Leitura é pública; escrita é
 * admin (role `plataforma-admin`).
 */
@Injectable({ providedIn: 'root' })
export class PesosEnemApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** GET `/api/configuracao/pesos-area-enem` — lista (vivas) por cursor. */
  listar(query: PesosAreaEnemQuery = {}): Observable<ApiResult<readonly PesoAreaEnemDto[]>> {
    let params = new HttpParams();
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
    } else {
      params = params.set('limit', String(query.limit ?? 100));
    }
    return this.http.get<ApiResult<readonly PesoAreaEnemDto[]>>(
      `${this.basePath}/api/configuracao/pesos-area-enem`,
      { params, context: withVendorMime('peso-area-enem', 1) },
    );
  }

  /** GET `/api/configuracao/pesos-area-enem/{id}` — detalhe. */
  obter(id: string): Observable<ApiResult<PesoAreaEnemDto>> {
    return this.http.get<ApiResult<PesoAreaEnemDto>>(
      `${this.basePath}/api/configuracao/pesos-area-enem/${encodeURIComponent(id)}`,
      { context: withVendorMime('peso-area-enem', 1) },
    );
  }

  /** POST `/api/configuracao/admin/pesos-area-enem` — cria. Idempotency-Key (ADR-0027). */
  criar(command: CriarPesoAreaEnemCommand, context: HttpContext): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(
      `${this.basePath}/api/configuracao/admin/pesos-area-enem`,
      command,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /** PUT `/api/configuracao/admin/pesos-area-enem/{id}` — atualiza. */
  atualizar(
    id: string,
    command: AtualizarPesoAreaEnemCommand,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/pesos-area-enem/${encodeURIComponent(id)}`,
      command,
      { context },
    );
  }

  /** DELETE `/api/configuracao/admin/pesos-area-enem/{id}` — soft-delete. */
  remover(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/pesos-area-enem/${encodeURIComponent(id)}`,
    );
  }
}
