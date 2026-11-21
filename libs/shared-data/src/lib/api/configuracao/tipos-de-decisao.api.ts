import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';
import { type ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type TipoDeDecisao = components['schemas']['TipoMotivoDeDecisao'];

@Injectable({ providedIn: 'root' })
export class TiposDeDecisaoApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  listar(): Observable<ApiResult<readonly TipoDeDecisao[]>> {
    return this.http.get<ApiResult<readonly TipoDeDecisao[]>>(
      `${this.basePath}/api/configuracao/vocabularios/tipos-de-decisao`,
      { context: withVendorMime('codigo-tipo-de-decisao', 1) },
    );
  }
}
