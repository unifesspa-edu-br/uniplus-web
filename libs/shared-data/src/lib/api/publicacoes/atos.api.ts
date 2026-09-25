import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { PUBLICACOES_BASE_PATH } from './tokens';

export type AtoNormativoDto = components['schemas']['AtoNormativoDto'];

/** Cliente de leitura dos atos normativos publicados. */
@Injectable({ providedIn: 'root' })
export class AtosApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(PUBLICACOES_BASE_PATH);

  /** GET `/api/publicacoes/atos/{id}` — um ato publicado pelo identificador. */
  obter(id: string): Observable<ApiResult<AtoNormativoDto>> {
    return this.http.get<ApiResult<AtoNormativoDto>>(
      `${this.basePath}/api/publicacoes/atos/${encodeURIComponent(id)}`,
      { context: withVendorMime('ato-normativo', 1) },
    );
  }
}
