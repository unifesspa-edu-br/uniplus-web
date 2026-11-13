import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type SolicitacaoDaProtecaoDto = components['schemas']['SolicitacaoDaProtecaoDto'];

/*
 * TODO(uniplus-api#2366): as manifestações técnicas e os campos novos de aprovação, atos e decisões
 * seguem o contrato combinado com a API e ainda não vêm do codegen. Depois do merge,
 * `npm run generate:api` os traz no `schema.ts`, e este bloco passa a apontar para ele.
 */

/** O parecer de quem se manifesta sobre a proteção proposta para o item. */
export type ParecerDaManifestacao = 'ADEQUADA' | 'RECOMENDA_AJUSTE' | 'INADEQUADA';

/** A manifestação vale no ciclo atual, foi substituída por outra da mesma pessoa ou é de ciclo encerrado. */
export type SituacaoDaManifestacao = 'VIGENTE' | 'SUBSTITUIDA' | 'ENCERRADA';

/** Uma manifestação técnica; o emissor e o identificador do autor não saem. */
export interface ManifestacaoDaProtecaoDto {
  readonly id: string;
  readonly ciclo: number;
  readonly parecer: ParecerDaManifestacao;
  readonly texto: string | null;
  readonly autorNome: string | null;
  readonly instante: string;
  readonly substituiId: string | null;
  readonly situacao: SituacaoDaManifestacao;
}

/** Registra a manifestação no ciclo lido; o texto é obrigatório nos pareceres desfavoráveis. */
export interface ManifestarProtecaoRequest {
  readonly cadastro: CadastroDoCatalogo;
  readonly itemId: string;
  readonly ciclo: number;
  readonly parecer: ParecerDaManifestacao;
  readonly texto: string | null;
}

/** A aprovação com o ciclo e a última manifestação, desfavorável ou não. */
export type AprovacaoDaProtecaoDto = components['schemas']['AprovacaoDaProtecaoDto'] & {
  readonly ciclo: number;
  readonly manifestadaEm: string | null;
  readonly manifestacaoDesfavoravel: boolean;
};

/** O ciclo do ato e se a decisão foi tomada diante de manifestação desfavorável vigente. */
interface CicloDoAto {
  readonly ciclo: number;
  readonly dianteDeManifestacaoDesfavoravel: boolean;
}

export type AtoDaProtecaoDto = components['schemas']['AtoDaProtecaoDto'] & CicloDoAto;
export type DecisaoDaProtecaoDto = components['schemas']['DecisaoDaProtecaoDto'] & CicloDoAto;

export type ItemDaProtecaoDoCatalogoDto = Omit<
  components['schemas']['ItemDaProtecaoDoCatalogoDto'],
  'aprovacao'
> & { readonly aprovacao: AprovacaoDaProtecaoDto };

export type DetalheDaProtecaoDoCatalogoDto = Omit<
  components['schemas']['DetalheDaProtecaoDoCatalogoDto'],
  'aprovacao' | 'atos'
> & {
  readonly aprovacao: AprovacaoDaProtecaoDto;
  readonly atos: readonly AtoDaProtecaoDto[];
  readonly manifestacoesVigentes: readonly ManifestacaoDaProtecaoDto[];
};
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

/** O segmento de cada cadastro nas rotas da proteção do catálogo. */
export const SEGMENTO_DO_CADASTRO: Readonly<Record<CadastroDoCatalogo, string>> = {
  TIPO_DOCUMENTO: 'tipos-documento',
  FATO: 'fatos',
};

/** A decisão e o cadastro do corpo, com os mesmos tokens do contrato (o gerador os tipa como enum). */
export type DecidirProtecaoDoCatalogoRequest = Omit<
  components['schemas']['DecidirProtecaoDoCatalogoRequest'],
  'cadastro' | 'decisao'
> & { readonly cadastro: CadastroDoCatalogo; readonly decisao: DecisaoDaProtecao };

/** Um item que o administrador escolheu para a solicitação. */
export type ItemParaSolicitarRequest = Omit<
  components['schemas']['ItemParaSolicitarRequest'],
  'cadastro'
> & {
  readonly cadastro: CadastroDoCatalogo;
};

/** O ato que fica registrado na proteção de um item: o pedido, a decisão da proteção de dados e o aceite do administrador. */
export type AtoDaProtecao =
  | 'SOLICITACAO'
  | 'APROVACAO'
  | 'AJUSTE_RECOMENDADO'
  | 'REPROVACAO'
  | 'ACEITE';

/** Os atos de decisão, que a lista de decisões traz. */
export type AtoDeDecisao = Extract<
  AtoDaProtecao,
  'APROVACAO' | 'AJUSTE_RECOMENDADO' | 'REPROVACAO'
>;

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
    const params =
      situacao === undefined ? new HttpParams() : new HttpParams().set('situacao', situacao);
    return this.http.get<ApiResult<readonly ItemDaProtecaoDoCatalogoDto[]>>(this.url(), {
      params,
      context: withVendorMime('protecao-do-catalogo', 1),
    });
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

  /**
   * POST `.../protecao-do-catalogo/manifestacoes` — registra a manifestação técnica no ciclo lido;
   * a nova da mesma pessoa substitui a vigente. Exige `Idempotency-Key` no contexto.
   */
  manifestar(
    request: ManifestarProtecaoRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.post<ApiResult<void>>(`${this.url()}/manifestacoes`, request, { context });
  }

  /** GET `.../protecao-do-catalogo/{tipos-documento|fatos}/{id}/manifestacoes` — o histórico do item. */
  manifestacoes(
    cadastro: CadastroDoCatalogo,
    id: string,
  ): Observable<ApiResult<readonly ManifestacaoDaProtecaoDto[]>> {
    return this.http.get<ApiResult<readonly ManifestacaoDaProtecaoDto[]>>(
      `${this.url()}/${SEGMENTO_DO_CADASTRO[cadastro]}/${encodeURIComponent(id)}/manifestacoes`,
      { context: withVendorMime('protecao-do-catalogo-manifestacao', 1) },
    );
  }

  /** POST `/api/configuracao/admin/protecao-do-catalogo` — aprova, recomenda ajuste ou reprova um item da solicitação. */
  decidir(
    command: DecidirProtecaoDoCatalogoRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.post<ApiResult<void>>(this.url(), command, { context });
  }

  private url(): string {
    return `${this.basePath}/api/configuracao/admin/protecao-do-catalogo`;
  }
}
