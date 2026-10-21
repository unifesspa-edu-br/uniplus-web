import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import { IDEMPOTENCY_KEY_TOKEN } from '@uniplus/shared-core/idempotency';
import type {
  ArquivoDaApresentacaoDto,
  AvaliacaoDaInscricaoDto,
  AvaliacaoDaInscricaoRequest,
  CancelamentoDaInscricaoRequest,
  ComprovanteInscricaoDto,
  IniciarEnvioDeDocumentoDaInscricaoDto,
  IniciarEnvioDeDocumentoDaInscricaoRequest,
  InscricaoDto,
  InscricaoRequest,
  MinhaInscricaoDto,
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
   * POST `…/inscricao/avaliacoes` — o que as respostas determinam, sem gravar nada: as respostas do
   * corpo são mescladas ao rascunho só para a conta.
   */
  avaliar(
    processoSeletivoId: string,
    request: AvaliacaoDaInscricaoRequest,
  ): Observable<ApiResult<AvaliacaoDaInscricaoDto>> {
    return this.http.post<ApiResult<AvaliacaoDaInscricaoDto>>(
      `${this.url(processoSeletivoId)}/avaliacoes`,
      request,
      { context: withVendorMime('avaliacao-da-inscricao', 1) },
    );
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

  /**
   * DELETE `…/inscricao` — descarta o rascunho. A inscrição enviada é recusada (422): sai pelo
   * cancelamento.
   */
  descartar(processoSeletivoId: string, eTag: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(this.url(processoSeletivoId), {
      headers: { 'If-Match': eTag },
    });
  }

  /**
   * POST `…/inscricao/cancelamento` — cancela a inscrição enviada. A Idempotency-Key vem do `context`
   * de quem chama; o motivo é opcional.
   */
  cancelar(
    processoSeletivoId: string,
    request: CancelamentoDaInscricaoRequest,
    eTag: string,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.post<ApiResult<void>>(
      `${this.url(processoSeletivoId)}/cancelamento`,
      request,
      {
        headers: { 'If-Match': eTag },
        context,
      },
    );
  }

  /**
   * GET `/api/selecao/inscricoes/{inscricaoId}/comprovantes/{numero}` — o comprovante da n-ésima
   * submissão, a contar de 1, pelo id da inscrição: alcança também a cancelada. Os anteriores
   * continuam acessíveis e não mudam.
   */
  obterComprovante(
    inscricaoId: string,
    numero: number,
  ): Observable<ApiResult<ComprovanteInscricaoDto>> {
    return this.http.get<ApiResult<ComprovanteInscricaoDto>>(
      `${this.basePath}/api/selecao/inscricoes/${encodeURIComponent(inscricaoId)}/comprovantes/${numero}`,
      { context: withVendorMime('comprovante-inscricao', 1) },
    );
  }

  /** GET `/api/selecao/minhas-inscricoes` — as inscrições do dono do token, em qualquer processo. */
  minhas(): Observable<ApiResult<readonly MinhaInscricaoDto[]>> {
    return this.http.get<ApiResult<readonly MinhaInscricaoDto[]>>(
      `${this.basePath}/api/selecao/minhas-inscricoes`,
      { context: withVendorMime('minhas-inscricoes', 1) },
    );
  }

  /**
   * POST `…/inscricao/documentos/envios` — passo 1 do envio de um documento exigido: confere a
   * exigência e devolve a URL pré-assinada de PUT. A Idempotency-Key vem do `context` de quem chama.
   */
  iniciarEnvioDeDocumento(
    processoSeletivoId: string,
    request: IniciarEnvioDeDocumentoDaInscricaoRequest,
    context: HttpContext,
  ): Observable<ApiResult<IniciarEnvioDeDocumentoDaInscricaoDto>> {
    return this.http.post<ApiResult<IniciarEnvioDeDocumentoDaInscricaoDto>>(
      `${this.url(processoSeletivoId)}/documentos/envios`,
      request,
      { context },
    );
  }

  /**
   * POST `…/inscricao/documentos/envios/{arquivoId}/confirmacao` — passo 3: a API lê o arquivo do
   * armazenamento, confere o conteúdo, passa o antivírus e o sela.
   */
  confirmarEnvioDeDocumento(
    processoSeletivoId: string,
    arquivoId: string,
    context: HttpContext,
  ): Observable<ApiResult<ArquivoDaApresentacaoDto>> {
    return this.http.post<ApiResult<ArquivoDaApresentacaoDto>>(
      `${this.url(processoSeletivoId)}/documentos/envios/${encodeURIComponent(arquivoId)}/confirmacao`,
      null,
      { context },
    );
  }

  /** DELETE `…/inscricao/documentos/arquivos/{arquivoId}` — remove o arquivo do rascunho. */
  removerArquivoDeDocumento(
    processoSeletivoId: string,
    arquivoId: string,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.url(processoSeletivoId)}/documentos/arquivos/${encodeURIComponent(arquivoId)}`,
      { context },
    );
  }

  private url(processoSeletivoId: string): string {
    return `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/inscricao`;
  }
}
