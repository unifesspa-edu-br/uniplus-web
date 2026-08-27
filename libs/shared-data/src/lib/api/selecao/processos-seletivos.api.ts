import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { SELECAO_BASE_PATH } from './tokens';

export type CriarProcessoSeletivoCommand = components['schemas']['CriarProcessoSeletivoCommand'];
export type ProcessoSeletivoDto = components['schemas']['ProcessoSeletivoDto'];
export type ProcessoSeletivoResumoDto = components['schemas']['ProcessoSeletivoResumoDto'];
export type TipoProcessoSnapshotDto = components['schemas']['TipoProcessoSnapshotDto'];
export type IniciarUploadDocumentoEditalDto =
  components['schemas']['IniciarUploadDocumentoEditalDto'];
export type DocumentoEditalDto = components['schemas']['DocumentoEditalDto'];
export type AcessoDocumentoEditalDto = components['schemas']['AcessoDocumentoEditalDto'];

/** Filtro da listagem de Processos Seletivos (cursor opaco, ADR-0026). */
export interface ProcessosSeletivosQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

/**
 * Cliente do agregado raiz Processo Seletivo.
 *
 * Criação referencia um tipo ativo por UUID. Consultas leem o snapshot
 * `tipoProcesso` retornado por Seleção, que não deve ser substituído por uma
 * nova consulta ao catálogo vivo (ADR-0122 da API).
 */
@Injectable({ providedIn: 'root' })
export class ProcessosSeletivosApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(SELECAO_BASE_PATH);

  /** GET `/api/selecao/processos-seletivos` — lista paginada por cursor opaco. */
  listar(
    query: ProcessosSeletivosQuery = {},
  ): Observable<ApiResult<readonly ProcessoSeletivoResumoDto[]>> {
    let params = new HttpParams();
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
    } else {
      params = params.set('limit', String(query.limit ?? 100));
    }

    return this.http.get<ApiResult<readonly ProcessoSeletivoResumoDto[]>>(
      `${this.basePath}/api/selecao/processos-seletivos`,
      { params, context: withVendorMime('processo-seletivo', 1) },
    );
  }

  /** GET `/api/selecao/processos-seletivos/{id}` — detalhe e snapshot do tipo. */
  obter(id: string): Observable<ApiResult<ProcessoSeletivoDto>> {
    return this.http.get<ApiResult<ProcessoSeletivoDto>>(
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(id)}`,
      { context: withVendorMime('processo-seletivo', 1) },
    );
  }

  /** POST `/api/selecao/processos-seletivos` — criação idempotente. */
  criar(
    command: CriarProcessoSeletivoCommand,
    context: HttpContext,
  ): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(
      `${this.basePath}/api/selecao/processos-seletivos`,
      command,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /**
   * GET `/api/selecao/processos-seletivos/{id}/documentos-edital` — todos os
   * documentos do edital registrados no processo, pendentes e confirmados.
   *
   * É a leitura que permite retomar o anexo depois de um refresh: o cliente
   * não guarda o `documentoEditalId` nem a URL assinada, então é daqui que o
   * editor descobre o que já existe. Havendo mais de um documento confirmado,
   * a escolha do oficial é do administrador — `criadoEm` e `confirmadoEm`
   * servem para apresentá-los, não para o frontend eleger o mais recente.
   *
   * A coleção não é paginada: um processo tem poucos documentos por natureza.
   */
  listarDocumentosEdital(
    processoSeletivoId: string,
  ): Observable<ApiResult<readonly DocumentoEditalDto[]>> {
    return this.http.get<ApiResult<readonly DocumentoEditalDto[]>>(
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/documentos-edital`,
      { context: withVendorMime('documento-edital', 1) },
    );
  }

  /**
   * GET `/api/selecao/processos-seletivos/{id}/documentos-edital/{docId}/acesso`
   * — pede o acesso de leitura a um documento confirmado, para conferir o PDF
   * anexado.
   *
   * A URL vem assinada e com validade curta, e é emitida a cada chamada: o
   * servidor não a distribui na listagem justamente para que o prazo comece
   * quando o acesso é pedido. Pelo mesmo motivo ela não é guardada aqui — quem
   * a tem abre o arquivo sem passar por autorização de novo.
   */
  obterAcessoDocumentoEdital(
    processoSeletivoId: string,
    documentoEditalId: string,
  ): Observable<ApiResult<AcessoDocumentoEditalDto>> {
    return this.http.get<ApiResult<AcessoDocumentoEditalDto>>(
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/documentos-edital/${encodeURIComponent(documentoEditalId)}/acesso`,
      { context: withVendorMime('acesso-documento-edital', 1) },
    );
  }

  /**
   * POST `/api/selecao/processos-seletivos/{id}/documentos-edital` — primeiro
   * dos três passos do anexo do edital: cria o registro pendente e devolve a
   * URL pré-assinada de PUT, o content type que a assinatura exige e o
   * instante em que ela expira. O endpoint não recebe corpo.
   */
  iniciarUploadDocumentoEdital(
    processoSeletivoId: string,
    context: HttpContext,
  ): Observable<ApiResult<IniciarUploadDocumentoEditalDto>> {
    return this.http.post<ApiResult<IniciarUploadDocumentoEditalDto>>(
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/documentos-edital`,
      null,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /**
   * Terceiro passo: a API lê o objeto no storage, confere content type,
   * tamanho e assinatura de arquivo, calcula o hash e sela o documento como
   * imutável. Também não recebe corpo.
   *
   * O segundo passo — o PUT na URL pré-assinada — não é rota do Uni+ e não
   * devolve `ApiResult`: fica no `SignedUploadClient` de `shared-core/http`.
   */
  confirmarUploadDocumentoEdital(
    processoSeletivoId: string,
    documentoEditalId: string,
    context: HttpContext,
  ): Observable<ApiResult<DocumentoEditalDto>> {
    return this.http.post<ApiResult<DocumentoEditalDto>>(
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/documentos-edital/${encodeURIComponent(documentoEditalId)}/confirmacao`,
      null,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }
}
