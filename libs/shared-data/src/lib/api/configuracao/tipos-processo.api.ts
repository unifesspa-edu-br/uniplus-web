import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type TipoProcessoDto = components['schemas']['TipoProcessoDto'];
export type CriarTipoProcessoCommand = components['schemas']['CriarTipoProcessoCommand'];
export type AtualizarTipoProcessoCommand = components['schemas']['AtualizarTipoProcessoCommand'];

/** Filtro de listagem de Tipos de Processo (cursor pagination, ADR-0026). */
export interface TiposProcessoQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

/**
 * Cliente Angular standalone do recurso Tipo de Processo (módulo
 * Configuração). Catálogo de processos seletivos (SiSU, PS, SisuVest, etc.)
 * usados transversalmente por editais, cursos e ofertas.
 *
 * API thin (ADR-0013): tipos do `schema.ts` gerado; resposta envelopada em
 * `ApiResult<T>` (ADR-0011); versionamento por vendor MIME `tipo-processo v1`
 * (ADR-0016/0028). Espelha `TiposDocumentoApi`/`CondicoesAtendimentoApi`.
 */
@Injectable({ providedIn: 'root' })
export class TiposProcessoApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** GET `/api/configuracao/tipos-processo` — lista paginada por cursor (ADR-0026). */
  listar(query: TiposProcessoQuery = {}): Observable<ApiResult<readonly TipoProcessoDto[]>> {
    let params = new HttpParams();
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
    } else {
      params = params.set('limit', String(query.limit ?? 100));
    }
    return this.http.get<ApiResult<readonly TipoProcessoDto[]>>(
      `${this.basePath}/api/configuracao/tipos-processo`,
      { params, context: withVendorMime('tipo-processo', 1) },
    );
  }

  /** GET `/api/configuracao/tipos-processo/{id}` — detalhe de um Tipo de Processo. */
  obter(id: string): Observable<ApiResult<TipoProcessoDto>> {
    return this.http.get<ApiResult<TipoProcessoDto>>(
      `${this.basePath}/api/configuracao/tipos-processo/${encodeURIComponent(id)}`,
      { context: withVendorMime('tipo-processo', 1) },
    );
  }

  /** POST `/api/configuracao/admin/tipos-processo` — cria um Tipo de Processo. Idempotency-Key obrigatório (ADR-0027). */
  criar(command: CriarTipoProcessoCommand, context: HttpContext): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(
      `${this.basePath}/api/configuracao/admin/tipos-processo`,
      command,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /** PUT `/api/configuracao/admin/tipos-processo/{id}` — atualiza um Tipo de Processo. */
  atualizar(
    id: string,
    command: AtualizarTipoProcessoCommand,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/tipos-processo/${encodeURIComponent(id)}`,
      command,
      { context },
    );
  }

  /** DELETE `/api/configuracao/admin/tipos-processo/{id}` — inativação (soft-delete). */
  remover(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/tipos-processo/${encodeURIComponent(id)}`,
    );
  }
}
