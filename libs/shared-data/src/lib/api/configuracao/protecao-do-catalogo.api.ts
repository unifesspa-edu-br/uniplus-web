import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type ItemDaProtecaoDoCatalogoDto = components['schemas']['ItemDaProtecaoDoCatalogoDto'];
export type AprovacaoDaProtecaoDto = components['schemas']['AprovacaoDaProtecaoDto'];
export type SolicitacaoDaProtecaoDto = components['schemas']['SolicitacaoDaProtecaoDto'];
export type DecidirProtecaoDoCatalogoCommand =
  components['schemas']['DecidirProtecaoDoCatalogoCommand'];

/** Onde um item do catálogo está no circuito de aprovação da proteção de dados. */
export type SituacaoDaAprovacao = 'PENDENTE' | 'SOLICITADA' | 'APROVADA' | 'NEGADA';

/** Qual cadastro do catálogo o item pertence. */
export type CadastroDoCatalogo = 'TIPO_DOCUMENTO' | 'FATO';

/**
 * Cliente do circuito de aprovação da proteção de dados do catálogo (UNI-REQ-0205): o que aguarda a
 * aprovação, a solicitação que o administrador envia e a decisão da proteção de dados. O aceite da
 * recomendação fica no cliente de cada cadastro, porque é de quem o mantém.
 *
 * API thin (ADR-0013): tipos do `schema.ts` gerado; resposta envelopada em `ApiResult<T>`;
 * escritas com Idempotency-Key no `context` (ADR-0027).
 */
@Injectable({ providedIn: 'root' })
export class ProtecaoDoCatalogoApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /**
   * GET `/api/configuracao/admin/protecao-do-catalogo` — os itens cuja proteção ainda não foi
   * aprovada, dos cadastros que a pessoa mantém ou aprova. Sem `situacao`, vêm todos.
   */
  listar(
    situacao?: Exclude<SituacaoDaAprovacao, 'APROVADA'>,
  ): Observable<ApiResult<readonly ItemDaProtecaoDoCatalogoDto[]>> {
    const params = situacao === undefined ? new HttpParams() : new HttpParams().set('situacao', situacao);
    return this.http.get<ApiResult<readonly ItemDaProtecaoDoCatalogoDto[]>>(this.url(), {
      params,
      context: withVendorMime('protecao-do-catalogo', 1),
    });
  }

  /** POST `/api/configuracao/admin/protecao-do-catalogo/solicitacoes` — envia todos os pendentes de uma vez. */
  solicitar(context: HttpContext): Observable<ApiResult<SolicitacaoDaProtecaoDto>> {
    return this.http.post<ApiResult<SolicitacaoDaProtecaoDto>>(`${this.url()}/solicitacoes`, null, {
      context,
    });
  }

  /** POST `/api/configuracao/admin/protecao-do-catalogo` — aprova ou nega um item da solicitação. */
  decidir(command: DecidirProtecaoDoCatalogoCommand, context: HttpContext): Observable<ApiResult<void>> {
    return this.http.post<ApiResult<void>>(this.url(), command, { context });
  }

  private url(): string {
    return `${this.basePath}/api/configuracao/admin/protecao-do-catalogo`;
  }
}
