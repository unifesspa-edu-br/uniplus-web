import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { DocumentoDaConfiguracao } from './documento-da-configuracao.contrato';
import { rotasDoProcesso } from './rotas-do-processo';
import { SELECAO_BASE_PATH } from './tokens';

/** Cliente da retificação do processo seletivo publicado. */
@Injectable({ providedIn: 'root' })
export class RetificacaoDoProcessoApi {
  private readonly http = inject(HttpClient);
  private readonly rotas = rotasDoProcesso(inject(SELECAO_BASE_PATH));

  /**
   * GET `…/processos-seletivos/{id}/configuracao` — a configuração inteira da versão vigente, ou da
   * `versao` pedida. O `ETag` da resposta (em `headers`) identifica a versão e é o que o envio da
   * retificação devolve em `If-Match`.
   */
  lerConfiguracaoDaVersao(
    processoSeletivoId: string,
    versao?: number,
  ): Observable<ApiResult<DocumentoDaConfiguracao>> {
    const params = versao === undefined ? new HttpParams() : new HttpParams().set('versao', versao);
    return this.http.get<ApiResult<DocumentoDaConfiguracao>>(
      this.rotas.doProcesso(processoSeletivoId, 'configuracao'),
      { params, context: withVendorMime('configuracao-de-processo-seletivo', 1) },
    );
  }
}
