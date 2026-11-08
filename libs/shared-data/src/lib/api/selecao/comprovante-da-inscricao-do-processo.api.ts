import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import { inscricaoDoProcessoUrl } from './inscricao-administrativa.request';
import type { ComprovanteDaInscricaoDto } from './inscricoes.contrato';
import { SELECAO_BASE_PATH } from './tokens';

/** Cliente do comprovante da inscrição na visão de quem opera o processo. */
@Injectable({ providedIn: 'root' })
export class ComprovanteDaInscricaoDoProcessoApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(SELECAO_BASE_PATH);

  /**
   * GET `…/inscricoes/{inscricaoId}/comprovantes/{numero}` — o comprovante do n-ésimo envio, a
   * contar de 1, também o da inscrição cancelada. A recusa de quem consulta mas não emite é 403; a
   * inscrição fora do processo ou do alcance, e o número inexistente, são 404.
   */
  obter(
    processoSeletivoId: string,
    inscricaoId: string,
    numero: number,
  ): Observable<ApiResult<ComprovanteDaInscricaoDto>> {
    const inscricao = inscricaoDoProcessoUrl(this.basePath, processoSeletivoId, inscricaoId);
    return this.http.get<ApiResult<ComprovanteDaInscricaoDto>>(
      `${inscricao}/comprovantes/${numero}`,
      {
        context: withVendorMime('comprovante-inscricao', 1),
      },
    );
  }
}
