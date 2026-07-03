import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type ModalidadeDto = components['schemas']['ModalidadeDto'];
export type CriarModalidadeCommand = components['schemas']['CriarModalidadeCommand'];
export type AtualizarModalidadeCommand = components['schemas']['AtualizarModalidadeCommand'];

/**
 * Rosters dos domínios fechados de Modalidade de concorrência — tokens
 * UPPER_SNAKE persistidos e aceitos pelo contrato (ver `NaturezasLegais`,
 * `ComposicoesVagas`, `RegrasRemanejamento` e `AcoesQuandoIndeferido` em
 * `Unifesspa.UniPlus.Configuracao.Domain.Enums`, uniplus-api #589). Não são enums
 * gerados pelo `openapi-typescript` — os campos chegam como `string` no
 * `schema.ts`; os tokens abaixo são copiados 1:1 do código-fonte do backend e o
 * domínio é a fonte de verdade das invariantes de coerência.
 */
export interface DominioOption<T extends string = string> {
  readonly value: T;
  readonly label: string;
}

export type NaturezaLegalToken = 'AMPLA' | 'COTA_RESERVADA' | 'SUPLEMENTAR' | 'OUTRA_MODALIDADE';

export const NATUREZAS_LEGAIS: readonly DominioOption<NaturezaLegalToken>[] = [
  { value: 'AMPLA', label: 'Ampla concorrência' },
  { value: 'COTA_RESERVADA', label: 'Cota reservada' },
  { value: 'SUPLEMENTAR', label: 'Suplementar' },
  { value: 'OUTRA_MODALIDADE', label: 'Outra modalidade' },
] as const;

/** Natureza legal default de uma nova modalidade (§3 da story). */
export const NATUREZA_LEGAL_DEFAULT: NaturezaLegalToken = 'AMPLA';

export type ComposicaoVagasToken =
  | 'RESIDUAL_DO_VO'
  | 'DENTRO_DO_VR'
  | 'RETIRA_DE'
  | 'SUPLEMENTAR_AO_TOTAL';

export const COMPOSICOES_VAGAS: readonly DominioOption<ComposicaoVagasToken>[] = [
  { value: 'RESIDUAL_DO_VO', label: 'Residual do VO' },
  { value: 'DENTRO_DO_VR', label: 'Dentro do VR' },
  { value: 'RETIRA_DE', label: 'Retira de' },
  { value: 'SUPLEMENTAR_AO_TOTAL', label: 'Suplementar ao total' },
] as const;

/** Composição default de uma nova modalidade (§3 da story). */
export const COMPOSICAO_VAGAS_DEFAULT: ComposicaoVagasToken = 'RESIDUAL_DO_VO';

/** Única composição que exige `composicaoOrigem` (equivalência exata, invariante do agregado). */
export const COMPOSICAO_RETIRA_DE: ComposicaoVagasToken = 'RETIRA_DE';

export type RegraRemanejamentoToken = 'SEGUE_CASCATA' | 'DESTINO_UNICO' | 'CRUZADO';

export const REGRAS_REMANEJAMENTO: readonly DominioOption<RegraRemanejamentoToken>[] = [
  { value: 'SEGUE_CASCATA', label: 'Segue cascata' },
  { value: 'DESTINO_UNICO', label: 'Destino único' },
  { value: 'CRUZADO', label: 'Cruzado' },
] as const;

export type AcaoQuandoIndeferidoToken = 'RECLASSIFICAR_AC' | 'RECLASSIFICAR_REGRA_EDITAL';

export const ACOES_QUANDO_INDEFERIDO: readonly DominioOption<AcaoQuandoIndeferidoToken>[] = [
  { value: 'RECLASSIFICAR_AC', label: 'Reclassificar em ampla concorrência' },
  { value: 'RECLASSIFICAR_REGRA_EDITAL', label: 'Reclassificar conforme regra do edital' },
] as const;

/**
 * Filtro de listagem de Modalidades (cursor pagination bidirecional, ADR-0026/0089).
 * A filtragem por Natureza/busca é client-side sobre a página carregada — o
 * contrato de listagem não expõe filtros de query além de cursor/limit/direction.
 */
export interface ModalidadesQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

/**
 * Cliente Angular standalone do recurso Modalidade de concorrência (módulo
 * Configuração, UNI-REQ-0011). A entidade mais rica do módulo: natureza legal,
 * composição de vagas, cascata de remanejamento e auto-referência por **código**
 * de outra modalidade viva (origem/destino/par/fallback são códigos, não ids).
 *
 * API thin (ADR-0013): tipos do `schema.ts` gerado; resposta envelopada em
 * `ApiResult<T>` (ADR-0011); versionamento por vendor MIME `modalidade v1`
 * (ADR-0016/0028) nos GET; mutação com `Idempotency-Key` (ADR-0027) via
 * `HttpContext`. Espelha `OfertasCursoApi`.
 *
 * O `Codigo` é imutável pós-criação (o comando de atualização não o aceita) e a
 * remoção é soft-delete, podendo ser bloqueada (409) quando outra modalidade viva
 * a referencia — o backend é a fonte autoritativa desse bloqueio.
 */
@Injectable({ providedIn: 'root' })
export class ModalidadesApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** GET `/api/configuracao/modalidades` — lista paginada por cursor (ADR-0026/0089). */
  listar(query: ModalidadesQuery = {}): Observable<ApiResult<readonly ModalidadeDto[]>> {
    let params = new HttpParams();
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
    } else {
      params = params.set('limit', String(query.limit ?? 100));
    }
    return this.http.get<ApiResult<readonly ModalidadeDto[]>>(
      `${this.basePath}/api/configuracao/modalidades`,
      { params, context: withVendorMime('modalidade', 1) },
    );
  }

  /** GET `/api/configuracao/modalidades/{id}` — detalhe de uma Modalidade. */
  obter(id: string): Observable<ApiResult<ModalidadeDto>> {
    return this.http.get<ApiResult<ModalidadeDto>>(
      `${this.basePath}/api/configuracao/modalidades/${encodeURIComponent(id)}`,
      { context: withVendorMime('modalidade', 1) },
    );
  }

  /** POST `/api/configuracao/admin/modalidades` — cria. Idempotency-Key obrigatório (ADR-0027). */
  criar(command: CriarModalidadeCommand, context: HttpContext): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(
      `${this.basePath}/api/configuracao/admin/modalidades`,
      command,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /** PUT `/api/configuracao/admin/modalidades/{id}` — atualiza os atributos editáveis (código imutável). */
  atualizar(
    id: string,
    command: AtualizarModalidadeCommand,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/modalidades/${encodeURIComponent(id)}`,
      command,
      { context },
    );
  }

  /**
   * DELETE `/api/configuracao/admin/modalidades/{id}` — remoção lógica (soft-delete).
   * Sem `Idempotency-Key` (o contrato não o exige). Pode responder 409 quando a
   * modalidade é referenciada por outra viva (origem/destino/par/fallback) — o
   * chamador trata o 409 como bloqueio autoritativo.
   */
  remover(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/modalidades/${encodeURIComponent(id)}`,
    );
  }
}
