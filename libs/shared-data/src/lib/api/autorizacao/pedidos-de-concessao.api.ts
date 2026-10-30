import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import { PaginaQuery, paramsDaPagina } from './paginacao';
import type { components } from './schema';
import { AUTORIZACAO_BASE_PATH } from './tokens';
import type { EventoDaTrilhaDto } from './concessoes.api';

export type PedidoDeConcessaoDto = components['schemas']['PedidoDeConcessaoDto'];
export type PedidoResumoDto = components['schemas']['PedidoResumoDto'];
export type AnexoDoPedidoDto = components['schemas']['AnexoDoPedidoDto'];
export type AnexoParaEnvioDto = components['schemas']['AnexoParaEnvioDto'];
export type LeituraDoAnexoDto = components['schemas']['LeituraDoAnexoDto'];
export type DecisaoDoPedidoDto = components['schemas']['DecisaoDoPedidoDto'];
export type PerfilParaPedidoDto = components['schemas']['PerfilParaPedidoDto'];
export type CriarPedidoDeConcessaoRequest = components['schemas']['CriarPedidoDeConcessaoRequest'];

/** Fila que a listagem devolve: os pedidos de quem pergunta ou a fila de uma das etapas de aprovação. */
export type FilaDePedidos = 'meus' | 'gestor' | 'protecao_de_dados' | 'todos';

export interface PedidosQuery extends PaginaQuery {
  readonly fila?: FilaDePedidos;
  readonly situacao?: string;
}

/** Cliente dos pedidos de concessão, com a dupla aprovação e os anexos. */
@Injectable({ providedIn: 'root' })
export class PedidosDeConcessaoApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);
  private readonly raiz = `${this.basePath}/api/autorizacao/pedidos-de-concessao`;

  /** GET `/api/autorizacao/pedidos-de-concessao` — a fila pedida, paginada por cursor. */
  listar(query: PedidosQuery = {}): Observable<ApiResult<readonly PedidoResumoDto[]>> {
    return this.http.get<ApiResult<readonly PedidoResumoDto[]>>(this.raiz, {
      params: paramsDaPagina(query, { fila: query.fila, situacao: query.situacao }),
      context: withVendorMime('pedido-de-concessao', 1),
    });
  }

  /**
   * GET `/api/autorizacao/perfis-para-pedido` — os perfis ativos que se podem pedir, paginados por cursor. Quem tem
   * e-mail institucional verificado, ou a permissão de manter perfis, lê; os demais recebem 403.
   */
  perfisParaPedir(query: PaginaQuery = {}): Observable<ApiResult<readonly PerfilParaPedidoDto[]>> {
    return this.http.get<ApiResult<readonly PerfilParaPedidoDto[]>>(
      `${this.basePath}/api/autorizacao/perfis-para-pedido`,
      { params: paramsDaPagina(query, {}), context: withVendorMime('perfil-para-pedido', 1) },
    );
  }

  /** GET `/api/autorizacao/pedidos-de-concessao/{id}`. */
  obter(id: string): Observable<ApiResult<PedidoDeConcessaoDto>> {
    return this.http.get<ApiResult<PedidoDeConcessaoDto>>(
      `${this.raiz}/${encodeURIComponent(id)}`,
      {
        context: withVendorMime('pedido-de-concessao', 1),
      },
    );
  }

  /** GET `/api/autorizacao/pedidos-de-concessao/{id}/trilha`. */
  trilha(id: string): Observable<ApiResult<readonly EventoDaTrilhaDto[]>> {
    return this.http.get<ApiResult<readonly EventoDaTrilhaDto[]>>(
      `${this.raiz}/${encodeURIComponent(id)}/trilha`,
      { context: withVendorMime('trilha-do-pedido', 1) },
    );
  }

  /** POST `/api/autorizacao/pedidos-de-concessao`. */
  criar(
    request: CriarPedidoDeConcessaoRequest,
    context: HttpContext,
  ): Observable<ApiResult<PedidoDeConcessaoDto>> {
    return this.http.post<ApiResult<PedidoDeConcessaoDto>>(this.raiz, request, { context });
  }

  /** DELETE `/api/autorizacao/pedidos-de-concessao/{id}` — o solicitante cancela antes da primeira decisão. */
  cancelar(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(`${this.raiz}/${encodeURIComponent(id)}`);
  }

  /** POST `.../{id}/aceite` — o beneficiário nomeado aceita o pedido. */
  aceitar(id: string, context: HttpContext): Observable<ApiResult<PedidoDeConcessaoDto>> {
    return this.http.post<ApiResult<PedidoDeConcessaoDto>>(
      `${this.raiz}/${encodeURIComponent(id)}/aceite`,
      null,
      { context },
    );
  }

  /** POST `.../{id}/aprovacoes` — aprova a etapa que o pedido aguarda. */
  aprovar(id: string, context: HttpContext): Observable<ApiResult<PedidoDeConcessaoDto>> {
    return this.http.post<ApiResult<PedidoDeConcessaoDto>>(
      `${this.raiz}/${encodeURIComponent(id)}/aprovacoes`,
      null,
      { context },
    );
  }

  /** POST `.../{id}/recusa` — recusa o pedido na etapa que ele aguarda, com motivo. */
  recusar(
    id: string,
    motivo: string,
    context: HttpContext,
  ): Observable<ApiResult<PedidoDeConcessaoDto>> {
    return this.http.post<ApiResult<PedidoDeConcessaoDto>>(
      `${this.raiz}/${encodeURIComponent(id)}/recusa`,
      { motivo },
      { context },
    );
  }

  /** POST `.../{id}/anexos` — registra o PDF e devolve a URL assinada de PUT. */
  iniciarAnexo(
    id: string,
    tamanhoDoPdf: number,
    context: HttpContext,
  ): Observable<ApiResult<AnexoParaEnvioDto>> {
    return this.http.post<ApiResult<AnexoParaEnvioDto>>(
      `${this.raiz}/${encodeURIComponent(id)}/anexos`,
      { tamanhoDoPdf },
      { context },
    );
  }

  /** POST `.../{id}/anexos/{anexoId}/confirmacao` — informa o ETag do PUT; o anexo segue para verificação. */
  confirmarAnexo(
    id: string,
    anexoId: string,
    etag: string | null,
    context: HttpContext,
  ): Observable<ApiResult<AnexoDoPedidoDto>> {
    return this.http.post<ApiResult<AnexoDoPedidoDto>>(
      `${this.raiz}/${encodeURIComponent(id)}/anexos/${encodeURIComponent(anexoId)}/confirmacao`,
      { etag },
      { context },
    );
  }

  /** GET `.../{id}/anexos/{anexoId}` — URL assinada de leitura, de validade curta. */
  acessoAoAnexo(id: string, anexoId: string): Observable<ApiResult<LeituraDoAnexoDto>> {
    return this.http.get<ApiResult<LeituraDoAnexoDto>>(
      `${this.raiz}/${encodeURIComponent(id)}/anexos/${encodeURIComponent(anexoId)}`,
      { context: withVendorMime('anexo-do-pedido', 1) },
    );
  }
}
