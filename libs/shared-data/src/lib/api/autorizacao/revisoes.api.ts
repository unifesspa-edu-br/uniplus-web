import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import { PaginaQuery, paramsDaPagina } from './paginacao';
import type { components } from './schema';
import { AUTORIZACAO_BASE_PATH } from './tokens';

/** Situação da revisão na API: com item pendente ela segue em andamento; sem nenhum, está concluída. */
export type SituacaoDaRevisao = 'em_andamento' | 'concluida';

/**
 * A página da lista de revisões; a `situacao`, quando informada, filtra no servidor antes da
 * paginação.
 */
export interface ListaDeRevisoesQuery extends PaginaQuery {
  readonly situacao?: SituacaoDaRevisao;
}

/** Situação do item: a decisão gravada, a espera dela ou a concessão que deixou de valer fora da revisão. */
export type SituacaoDoItemDaRevisao =
  | 'pendente'
  | 'confirmada'
  | 'revogada'
  | 'concessao_encerrada';

/**
 * Quem decide o item (ADR-0162): o Representante do controlador decide os itens comuns, e a gestão de
 * acessos, os de quem é Representante. No item pendente é quem decidiria agora; no decidido, a governança gravada.
 */
export type QuemDecideOItem = 'representante-do-controlador' | 'gestor-de-acessos';

/*
 * O contrato gerado traz situação e quem decide como `string`; os tipos abaixo dão a eles os
 * valores que o contrato documenta, para a tela tratar cada caso pelo nome.
 */
type ComSituacao<T> = Omit<T, 'situacao'> & { readonly situacao: SituacaoDaRevisao };

export type RevisaoResumoDto = ComSituacao<components['schemas']['RevisaoResumoDto']>;

/** O item da revisão; `ehDoLeitor` diz que a concessão é de quem lê, que não pode decidi-la. */
export type ItemDaRevisaoDto = Omit<
  components['schemas']['ItemDaRevisaoDto'],
  'situacao' | 'decide'
> & {
  readonly situacao: SituacaoDoItemDaRevisao;
  readonly decide: QuemDecideOItem;
};

export type RevisaoDeAcessosDto = Omit<
  ComSituacao<components['schemas']['RevisaoDeAcessosDto']>,
  'itens'
> & {
  readonly itens: readonly ItemDaRevisaoDto[];
};
export type RevogarItemDaRevisaoRequest = components['schemas']['RevogarItemDaRevisaoRequest'];

/** Cliente da revisão periódica dos acessos a dado pessoal ou sensível. */
@Injectable({ providedIn: 'root' })
export class RevisoesApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);
  private readonly raiz = `${this.basePath}/api/autorizacao/revisoes`;

  /** GET `/api/autorizacao/revisoes` — as revisões, todas ou só as da situação, paginadas por cursor. */
  listar(query: ListaDeRevisoesQuery = {}): Observable<ApiResult<readonly RevisaoResumoDto[]>> {
    return this.http.get<ApiResult<readonly RevisaoResumoDto[]>>(this.raiz, {
      params: paramsDaPagina(query, { situacao: query.situacao }),
      context: withVendorMime('revisao-de-acessos', 1),
    });
  }

  /** GET `/api/autorizacao/revisoes/{id}` — a revisão com os itens e quem decide cada um. */
  obter(id: string): Observable<ApiResult<RevisaoDeAcessosDto>> {
    return this.http.get<ApiResult<RevisaoDeAcessosDto>>(this.endereco(id), {
      context: withVendorMime('revisao-de-acessos', 1),
    });
  }

  /** POST `/api/autorizacao/revisoes` — abre a revisão; só uma fica em andamento por vez. */
  abrir(context: HttpContext): Observable<ApiResult<RevisaoDeAcessosDto>> {
    return this.http.post<ApiResult<RevisaoDeAcessosDto>>(this.raiz, null, { context });
  }

  /** POST `.../{id}/itens/{item}/confirmacao` — mantém a concessão do item. */
  confirmar(id: string, item: string, context: HttpContext): Observable<ApiResult<void>> {
    return this.http.post<ApiResult<void>>(`${this.doItem(id, item)}/confirmacao`, null, {
      context,
    });
  }

  /** POST `.../{id}/itens/{item}/revogacao` — revoga a concessão do item, com o motivo na trilha. */
  revogar(
    id: string,
    item: string,
    request: RevogarItemDaRevisaoRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.post<ApiResult<void>>(`${this.doItem(id, item)}/revogacao`, request, {
      context,
    });
  }

  private endereco(id: string): string {
    return `${this.raiz}/${encodeURIComponent(id)}`;
  }

  private doItem(id: string, item: string): string {
    return `${this.endereco(id)}/itens/${encodeURIComponent(item)}`;
  }
}
