import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult } from '@uniplus/shared-core/http';
import type { PerfilDto } from './perfis.api';
import type { components } from './schema';
import { AUTORIZACAO_BASE_PATH } from './tokens';

export type ProporVersaoRequest = components['schemas']['ProporVersaoRequest'];
export type VersaoPendenteDto = components['schemas']['VersaoPendenteDto'];
export type DecisaoDaVersaoDto = components['schemas']['DecisaoDaVersaoDto'];
export type ItemDaFilaDeVersoesDto = components['schemas']['ItemDaFilaDeVersoesDto'];
export type EnvioDoDocumentoDto = components['schemas']['EnvioDoDocumentoDto'];
export type DocumentoDaVersaoDto = components['schemas']['DocumentoDaVersaoDto'];
export type LeituraDoDocumentoDaVersaoDto = components['schemas']['LeituraDoDocumentoDaVersaoDto'];

/** Etapa da aprovação de uma versão: cada uma tem a própria fila e a própria permissão. */
export type EtapaDaVersao = 'gestao_de_acessos' | 'protecao_de_dados';

/** A proposta devolve o envio do documento quando cria versão pendente, ou o perfil quando só retirou permissões. */
export type ResultadoDaProposta = EnvioDoDocumentoDto | PerfilDto;

/** Cliente das versões do perfil, do documento que as institui e da aprovação delas. */
@Injectable({ providedIn: 'root' })
export class VersoesDoPerfilApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);
  private readonly raiz = `${this.basePath}/api/autorizacao`;

  /** POST `.../perfis/{id}/versoes` — propõe a versão; a retirada de permissões vale na hora. */
  propor(
    perfilId: string,
    request: ProporVersaoRequest,
    context: HttpContext,
  ): Observable<ApiResult<ResultadoDaProposta>> {
    return this.http.post<ApiResult<ResultadoDaProposta>>(
      `${this.versoes(perfilId)}`,
      request,
      { context },
    );
  }

  /** POST `.../versoes/{versaoId}/cancelamento` — cancela a versão pendente, com motivo. */
  cancelar(
    perfilId: string,
    versaoId: string,
    motivo: string,
    context: HttpContext,
  ): Observable<ApiResult<PerfilDto>> {
    return this.http.post<ApiResult<PerfilDto>>(
      `${this.versoes(perfilId)}/${encodeURIComponent(versaoId)}/cancelamento`,
      { motivo },
      { context },
    );
  }

  /** POST `.../versoes/{versaoId}/aprovacao` — aprova a etapa que a versão aguarda. */
  aprovar(
    perfilId: string,
    versaoId: string,
    etapa: EtapaDaVersao,
    context: HttpContext,
  ): Observable<ApiResult<PerfilDto>> {
    return this.http.post<ApiResult<PerfilDto>>(
      `${this.versoes(perfilId)}/${encodeURIComponent(versaoId)}/aprovacao`,
      { etapa },
      { context },
    );
  }

  /** POST `.../versoes/{versaoId}/recusa` — recusa a etapa que a versão aguarda, com motivo. */
  recusar(
    perfilId: string,
    versaoId: string,
    recusa: { readonly etapa: EtapaDaVersao; readonly motivo: string },
    context: HttpContext,
  ): Observable<ApiResult<PerfilDto>> {
    return this.http.post<ApiResult<PerfilDto>>(
      `${this.versoes(perfilId)}/${encodeURIComponent(versaoId)}/recusa`,
      recusa,
      { context },
    );
  }

  /** GET `.../versoes-de-perfil` — as versões pendentes que aguardam a etapa da fila. */
  fila(etapa: EtapaDaVersao): Observable<ApiResult<readonly ItemDaFilaDeVersoesDto[]>> {
    return this.http.get<ApiResult<readonly ItemDaFilaDeVersoesDto[]>>(
      `${this.raiz}/versoes-de-perfil`,
      { params: new HttpParams().set('fila', etapa) },
    );
  }

  /** POST `.../documento` — URL de envio de outro documento, depois que a verificação recusou o anterior. */
  novoDocumento(
    perfilId: string,
    versaoId: string,
    tamanhoDoDocumento: number,
    context: HttpContext,
  ): Observable<ApiResult<EnvioDoDocumentoDto>> {
    return this.http.post<ApiResult<EnvioDoDocumentoDto>>(
      this.documento(perfilId, versaoId),
      { tamanhoDoDocumento },
      { context },
    );
  }

  /** POST `.../documento/envio` — outra URL de envio para o documento que ainda aguarda o arquivo. */
  reemitirEnvio(
    perfilId: string,
    versaoId: string,
    context: HttpContext,
  ): Observable<ApiResult<EnvioDoDocumentoDto>> {
    return this.http.post<ApiResult<EnvioDoDocumentoDto>>(
      `${this.documento(perfilId, versaoId)}/envio`,
      null,
      { context },
    );
  }

  /** POST `.../documento/confirmacao` — informa o ETag do envio; o PDF segue para a verificação. */
  confirmarDocumento(
    perfilId: string,
    versaoId: string,
    etag: string | null,
  ): Observable<ApiResult<DocumentoDaVersaoDto>> {
    return this.http.post<ApiResult<DocumentoDaVersaoDto>>(
      `${this.documento(perfilId, versaoId)}/confirmacao`,
      { etag },
    );
  }

  /** GET `.../documento` — URL assinada de leitura do documento verificado, de validade curta. */
  lerDocumento(
    perfilId: string,
    versaoId: string,
  ): Observable<ApiResult<LeituraDoDocumentoDaVersaoDto>> {
    return this.http.get<ApiResult<LeituraDoDocumentoDaVersaoDto>>(
      this.documento(perfilId, versaoId),
    );
  }

  private versoes(perfilId: string): string {
    return `${this.raiz}/perfis/${encodeURIComponent(perfilId)}/versoes`;
  }

  private documento(perfilId: string, versaoId: string): string {
    return `${this.versoes(perfilId)}/${encodeURIComponent(versaoId)}/documento`;
  }
}
