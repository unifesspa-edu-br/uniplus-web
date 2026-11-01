import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type ItemDaProtecaoDoCatalogoDto = components['schemas']['ItemDaProtecaoDoCatalogoDto'];
export type AprovacaoDaProtecaoDto = components['schemas']['AprovacaoDaProtecaoDto'];
export type SolicitacaoDaProtecaoDto = components['schemas']['SolicitacaoDaProtecaoDto'];
export type DetalheDaProtecaoDoCatalogoDto = components['schemas']['DetalheDaProtecaoDoCatalogoDto'];
export type DecisaoDaProtecaoDto = components['schemas']['DecisaoDaProtecaoDto'];
export type AtoDaProtecaoDto = components['schemas']['AtoDaProtecaoDto'];
export type DetalheDoFatoDto = components['schemas']['DetalheDoFatoDto'];
export type DetalheDoTipoDeDocumentoDto = components['schemas']['DetalheDoTipoDeDocumentoDto'];
export type DetalheDoValorDoFatoDto = components['schemas']['DetalheDoValorDoFatoDto'];

/** Onde um item do catálogo está no circuito de aprovação da proteção de dados. */
export type SituacaoDaAprovacao =
  | 'PENDENTE'
  | 'SOLICITADA'
  | 'APROVADA'
  | 'AJUSTE_RECOMENDADO'
  | 'REPROVADA';

/** A decisão da proteção de dados sobre um item solicitado. */
export type DecisaoDaProtecao = 'APROVAR' | 'RECOMENDAR_AJUSTE' | 'REPROVAR';

/** Qual cadastro do catálogo o item pertence. */
export type CadastroDoCatalogo = 'TIPO_DOCUMENTO' | 'FATO';

/** A decisão e o cadastro do corpo, com os mesmos tokens do contrato (o gerador os tipa como enum). */
export type DecidirProtecaoDoCatalogoRequest = Omit<
  components['schemas']['DecidirProtecaoDoCatalogoRequest'],
  'cadastro' | 'decisao'
> & { readonly cadastro: CadastroDoCatalogo; readonly decisao: DecisaoDaProtecao };

/** Um item que o administrador escolheu para a solicitação. */
export type ItemParaSolicitarRequest = Omit<components['schemas']['ItemParaSolicitarRequest'], 'cadastro'> & {
  readonly cadastro: CadastroDoCatalogo;
};

/** O ato que fica registrado na proteção de um item: o pedido, a decisão da proteção de dados e o aceite do administrador. */
export type AtoDaProtecao = 'SOLICITACAO' | 'APROVACAO' | 'AJUSTE_RECOMENDADO' | 'REPROVACAO' | 'ACEITE';

/** Os atos de decisão, que a lista de decisões traz. */
export type AtoDeDecisao = Extract<AtoDaProtecao, 'APROVACAO' | 'AJUSTE_RECOMENDADO' | 'REPROVACAO'>;

/** Filtros e janela da lista de decisões (cursor, ADR-0026). Os filtros vão em toda página. */
export interface DecisoesQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
  readonly ato?: readonly AtoDeDecisao[];
  readonly cadastro?: CadastroDoCatalogo;
  /** Data inicial, no formato AAAA-MM-DD. */
  readonly de?: string;
  /** Data final, no formato AAAA-MM-DD. */
  readonly ate?: string;
  readonly busca?: string;
  /** Só as decisões de quem consulta. */
  readonly minhas?: boolean;
}

/** O segmento da rota de detalhe de cada cadastro. */
const SEGMENTO_DO_CADASTRO: Readonly<Record<CadastroDoCatalogo, string>> = {
  TIPO_DOCUMENTO: 'tipos-documento',
  FATO: 'fatos',
};

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

  /**
   * GET `/api/configuracao/admin/protecao-do-catalogo/decisoes` — as decisões registradas (aprovação,
   * ajuste recomendado, reprovação), da mais recente à mais antiga, paginadas por cursor. Exige a
   * permissão de aprovar.
   */
  listarDecisoes(query: DecisoesQuery = {}): Observable<ApiResult<readonly DecisaoDaProtecaoDto[]>> {
    let params = new HttpParams();
    for (const ato of query.ato ?? []) params = params.append('ato', ato);
    if (query.cadastro !== undefined) params = params.set('cadastro', query.cadastro);
    if (query.de) params = params.set('de', query.de);
    if (query.ate) params = params.set('ate', query.ate);
    const busca = query.busca?.trim();
    if (busca) params = params.set('busca', busca);
    if (query.minhas) params = params.set('minhas', 'true');
    params =
      query.cursor !== undefined
        ? params.set('cursor', query.cursor).set('direction', query.direction ?? 'next')
        : params.set('limit', String(query.limit ?? 25));
    return this.http.get<ApiResult<readonly DecisaoDaProtecaoDto[]>>(`${this.url()}/decisoes`, {
      params,
      context: withVendorMime('protecao-do-catalogo-decisao', 1),
    });
  }

  /**
   * GET `/api/configuracao/admin/protecao-do-catalogo/{cadastro}/{id}` — o item como a proteção de dados
   * o decide, em qualquer situação da aprovação. Exige a permissão de aprovar, não a de consultar o cadastro.
   */
  detalhar(
    cadastro: CadastroDoCatalogo,
    id: string,
  ): Observable<ApiResult<DetalheDaProtecaoDoCatalogoDto>> {
    return this.http.get<ApiResult<DetalheDaProtecaoDoCatalogoDto>>(
      `${this.url()}/${SEGMENTO_DO_CADASTRO[cadastro]}/${id}`,
      { context: withVendorMime('protecao-do-catalogo-detalhe', 1) },
    );
  }

  /** POST `/api/configuracao/admin/protecao-do-catalogo/solicitacoes` — envia à proteção de dados só os itens escolhidos. */
  solicitar(
    itens: readonly ItemParaSolicitarRequest[],
    context: HttpContext,
  ): Observable<ApiResult<SolicitacaoDaProtecaoDto>> {
    return this.http.post<ApiResult<SolicitacaoDaProtecaoDto>>(
      `${this.url()}/solicitacoes`,
      { itens },
      { context },
    );
  }

  /** POST `/api/configuracao/admin/protecao-do-catalogo` — aprova, recomenda ajuste ou reprova um item da solicitação. */
  decidir(command: DecidirProtecaoDoCatalogoRequest, context: HttpContext): Observable<ApiResult<void>> {
    return this.http.post<ApiResult<void>>(this.url(), command, { context });
  }

  private url(): string {
    return `${this.basePath}/api/configuracao/admin/protecao-do-catalogo`;
  }
}
