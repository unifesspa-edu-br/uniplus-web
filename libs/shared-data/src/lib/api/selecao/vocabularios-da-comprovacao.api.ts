import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { rotasDoProcesso } from './rotas-do-processo';
import { SELECAO_BASE_PATH } from './tokens';

export type FormaDeComprovacaoDto = components['schemas']['FormaDeComprovacao'];

@Injectable({ providedIn: 'root' })
export class VocabulariosDaComprovacaoApi {
  private readonly http = inject(HttpClient);
  private readonly rotas = rotasDoProcesso(inject(SELECAO_BASE_PATH));

  listarFormasDeComprovacao(): Observable<ApiResult<readonly FormaDeComprovacaoDto[]>> {
    return this.http.get<ApiResult<readonly FormaDeComprovacaoDto[]>>(
      this.rotas.doVocabulario('formas-comprovacao'),
      { context: withVendorMime('forma-de-comprovacao', 1) },
    );
  }
}
