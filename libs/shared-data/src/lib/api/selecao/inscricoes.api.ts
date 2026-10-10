import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import { IDEMPOTENCY_KEY_TOKEN } from '@uniplus/shared-core/idempotency';
import type {
  ComprovanteInscricaoDto,
  InscricaoDto,
  InscricaoRequest,
} from './inscricoes.contrato';
import type { FormularioRenderizavelDto } from './processos-seletivos.api';
import { SELECAO_BASE_PATH } from './tokens';

/**
 * Cliente da inscrição do candidato no módulo Seleção. A inscrição é sempre a do dono do token, uma
 * por processo; salvar e enviar exigem o `If-Match` com o ETag da revisão corrente.
 */
@Injectable({ providedIn: 'root' })
export class InscricoesApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(SELECAO_BASE_PATH);

  /** GET `…/inscricao` — a inscrição como está gravada. */
  obter(processoSeletivoId: string): Observable<ApiResult<InscricaoDto>> {
    return this.http.get<ApiResult<InscricaoDto>>(this.url(processoSeletivoId), {
      context: withVendorMime('inscricao', 1),
    });
  }

  /** POST `…/inscricao` — inicia o rascunho, ou devolve a inscrição que já existe. */
  iniciar(processoSeletivoId: string): Observable<ApiResult<InscricaoDto>> {
    return this.http.post<ApiResult<InscricaoDto>>(this.url(processoSeletivoId), null, {
      context: withVendorMime('inscricao', 1),
    });
  }

  /** GET `…/inscricao/formulario` — o formulário da versão que a inscrição fixou ao nascer. */
  obterFormulario(processoSeletivoId: string): Observable<ApiResult<FormularioRenderizavelDto>> {
    return this.http.get<ApiResult<FormularioRenderizavelDto>>(
      `${this.url(processoSeletivoId)}/formulario`,
      { context: withVendorMime('formulario-inscricao', 1) },
    );
  }

  /** PUT `…/inscricao` — salva o rascunho. */
  salvar(
    processoSeletivoId: string,
    request: InscricaoRequest,
    eTag: string,
  ): Observable<ApiResult<InscricaoDto>> {
    return this.http.put<ApiResult<InscricaoDto>>(this.url(processoSeletivoId), request, {
      headers: { 'If-Match': eTag },
      context: withVendorMime('inscricao', 1),
    });
  }

  /**
   * POST `…/inscricao/submissao` — envia ou corrige a inscrição. A Idempotency-Key vem do `context`
   * de quem chama: repetir a mesma chave devolve o comprovante já emitido.
   */
  submeter(
    processoSeletivoId: string,
    request: InscricaoRequest,
    eTag: string,
    context: HttpContext,
  ): Observable<ApiResult<ComprovanteInscricaoDto>> {
    return this.http.post<ApiResult<ComprovanteInscricaoDto>>(
      `${this.url(processoSeletivoId)}/submissao`,
      request,
      {
        headers: { 'If-Match': eTag },
        context: withVendorMime('comprovante-inscricao', 1).set(
          IDEMPOTENCY_KEY_TOKEN,
          context.get(IDEMPOTENCY_KEY_TOKEN),
        ),
      },
    );
  }

  private url(processoSeletivoId: string): string {
    return `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/inscricao`;
  }
}
