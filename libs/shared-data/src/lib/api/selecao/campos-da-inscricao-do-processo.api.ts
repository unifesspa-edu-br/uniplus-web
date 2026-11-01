import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import { inscricaoDoProcessoUrl } from './inscricao-administrativa.request';
import type { CampoReveladoDto } from './inscricoes.contrato';
import { SELECAO_BASE_PATH } from './tokens';

/** Cliente da revelação, a pedido de quem opera o processo, do valor de um campo da inscrição. */
@Injectable({ providedIn: 'root' })
export class CamposDaInscricaoDoProcessoApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(SELECAO_BASE_PATH);

  /**
   * POST `…/inscricoes/{inscricaoId}/campos/{fatoCodigo}/revelacao` — o valor sem máscara de um
   * campo. Cada pedido revela um campo; `ocorrenciaId` indica a ocorrência quando o campo está em
   * grupo. A API recusa com 404 o que a pessoa não pode revelar.
   */
  revelar(
    processoSeletivoId: string,
    inscricaoId: string,
    fatoCodigo: string,
    ocorrenciaId: string | null,
  ): Observable<ApiResult<CampoReveladoDto>> {
    const inscricao = inscricaoDoProcessoUrl(this.basePath, processoSeletivoId, inscricaoId);
    return this.http.post<ApiResult<CampoReveladoDto>>(
      `${inscricao}/campos/${encodeURIComponent(fatoCodigo)}/revelacao`,
      null,
      {
        context: withVendorMime('campo-revelado-da-inscricao', 1),
        params:
          ocorrenciaId === null ? undefined : new HttpParams().set('ocorrencia', ocorrenciaId),
      },
    );
  }
}
