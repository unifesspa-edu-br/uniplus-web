import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type TipoProcessoDto = components['schemas']['TipoProcessoDto'];

/** Filtro da listagem pública paginada de tipos ativos (cursor opaco, ADR-0026). */
export interface TiposProcessoQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

/**
 * Cliente de leitura pública dos tipos de Processo Seletivo configuráveis.
 *
 * A origem dos tipos é o módulo Configuração; consumidores de Seleção devem
 * guardar o `id` retornado ao criar um Processo Seletivo, sem manter um
 * vocabulário local dos tipos semeados (ADR-0122 da API).
 */
@Injectable({ providedIn: 'root' })
export class TiposProcessoApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** GET `/api/configuracao/tipos-processo` — itens ativos, paginação por cursor opaco. */
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
}
