import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, janelaDaPagina, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type TipoConceitoDto = components['schemas']['TipoConceitoDto'];

/** Filtro da listagem de tipos de conceito (cursor pagination, ADR-0026). */
export interface TiposConceitoQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

/**
 * Cliente de leitura do catálogo de tipos de conceito (módulo Configuração): o vocabulário de
 * resultados, numéricos ou categóricos, que um tipo de etapa pode declarar como admitidos.
 *
 * API thin (ADR-0013): tipos do `schema.ts` gerado; resposta envelopada em `ApiResult<T>`
 * (ADR-0011); versionamento por vendor MIME `tipo-conceito v1` (ADR-0016/0028).
 */
@Injectable({ providedIn: 'root' })
export class TiposConceitoApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** GET `/api/configuracao/tipos-conceito` — lista paginada por cursor (ADR-0026). */
  listar(query: TiposConceitoQuery = {}): Observable<ApiResult<readonly TipoConceitoDto[]>> {
    return this.http.get<ApiResult<readonly TipoConceitoDto[]>>(
      `${this.basePath}/api/configuracao/tipos-conceito`,
      {
        params: janelaDaPagina(new HttpParams(), query),
        context: withVendorMime('tipo-conceito', 1),
      },
    );
  }
}
