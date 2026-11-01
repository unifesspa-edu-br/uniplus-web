import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import { inscricaoDoProcessoUrl } from './inscricao-administrativa.request';
import type { AcessoArquivoDoCandidatoDto } from './inscricoes.contrato';
import { SELECAO_BASE_PATH } from './tokens';

/** Cliente do acesso de quem opera o processo aos arquivos enviados pelos candidatos. */
@Injectable({ providedIn: 'root' })
export class ArquivosDaInscricaoDoProcessoApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(SELECAO_BASE_PATH);

  /**
   * GET `…/inscricoes/{inscricaoId}/documentos/arquivos/{arquivoId}/acesso` — a URL de curta
   * validade do arquivo, pela permissão da classificação congelada do documento. O acesso fica
   * registrado na API; a recusa responde 404. A URL é credencial: quem a pede a usa na hora e não a
   * guarda.
   */
  obterAcesso(
    processoSeletivoId: string,
    inscricaoId: string,
    arquivoId: string,
  ): Observable<ApiResult<AcessoArquivoDoCandidatoDto>> {
    const inscricao = inscricaoDoProcessoUrl(this.basePath, processoSeletivoId, inscricaoId);
    return this.http.get<ApiResult<AcessoArquivoDoCandidatoDto>>(
      `${inscricao}/documentos/arquivos/${encodeURIComponent(arquivoId)}/acesso`,
      { context: withVendorMime('acesso-arquivo-da-inscricao', 1) },
    );
  }
}
