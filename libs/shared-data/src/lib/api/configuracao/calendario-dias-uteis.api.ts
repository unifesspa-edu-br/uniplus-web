import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type DiaNaoUtilCommandItem = components['schemas']['DiaNaoUtilCommandItem'];
export type DiaNaoUtilDto = components['schemas']['DiaNaoUtilDto'];
export type CalendarioDiasUteisDto = components['schemas']['CalendarioDiasUteisDto'];
export type CalendarioDiasUteisResumoDto = components['schemas']['CalendarioDiasUteisResumoDto'];
export type CriarCalendarioDiasUteisCommand =
  components['schemas']['CriarCalendarioDiasUteisCommand'];

/** Filtro de listagem de CalendárioDiasUteis (cursor pagination, ADR-0026). */
export interface PaginacaoQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

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

export { UNIDADES_FEDERATIVAS, type UnidadeFederativa } from '@uniplus/shared-utils';

export type AbrangenciasToken = 'INSTITUCIONAL' | 'MUNICIPAL' | 'ESTADUAL' | 'NACIONAL';

export const ABRANGENCIAS: readonly DominioOption<AbrangenciasToken>[] = [
  { value: 'INSTITUCIONAL', label: 'Institucional' },
  { value: 'MUNICIPAL', label: 'Municipal' },
  { value: 'ESTADUAL', label: 'Estadual' },
  { value: 'NACIONAL', label: 'Nacional' },
] as const;

/** Cliente HTTP do cadastro de calendários de dias úteis. */
@Injectable({ providedIn: 'root' })
export class CalendarioDiasUteisApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** GET `/api/configuracao/calendarios-dias-uteis` — lista paginada por cursor (ADR-0026). */
  listar(
    query: PaginacaoQuery = {},
  ): Observable<ApiResult<readonly CalendarioDiasUteisResumoDto[]>> {
    let params = new HttpParams();
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
    } else {
      params = params.set('limit', String(query.limit ?? 100));
    }
    return this.http.get<ApiResult<readonly CalendarioDiasUteisResumoDto[]>>(
      `${this.basePath}/api/configuracao/calendarios-dias-uteis`,
      {
        params,
        context: withVendorMime('calendario-dias-uteis', 1),
      },
    );
  }

  /** GET `/api/configuracao/calendarios-dias-uteis/{id}` — detalhe de um calendário dia útil. */
  obter(id: string): Observable<ApiResult<CalendarioDiasUteisDto>> {
    return this.http.get<ApiResult<CalendarioDiasUteisDto>>(
      `${this.basePath}/api/configuracao/calendarios-dias-uteis/${encodeURIComponent(id)}`,
      { context: withVendorMime('calendario-dias-uteis', 1) },
    );
  }

  /** POST `/api/configuracao/admin/calendarios-dias-uteis` — cria um calendários de dias úteis. Idempotency-Key obrigatório (ADR-0027). */
  criar(
    command: CriarCalendarioDiasUteisCommand,
    context: HttpContext,
  ): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(
      `${this.basePath}/api/configuracao/admin/calendarios-dias-uteis`,
      command,
      {
        context,
        headers: new HttpHeaders({ Accept: 'application/json' }),
      },
    );
  }

  /** POST `/api/configuracao/admin/calendarios-dias-uteis/{id}/vigente` — torna o dataset vigente. */
  marcarVigente(id: string, context: HttpContext): Observable<ApiResult<void>> {
    return this.http.post<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/calendarios-dias-uteis/${encodeURIComponent(id)}/vigente`,
      null,
      {
        context,
      },
    );
  }

  /** DELETE `/api/configuracao/admin/calendarios-dias-uteis/{id}` — remoção lógica (soft-delete). */
  remover(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/calendarios-dias-uteis/${encodeURIComponent(id)}`,
    );
  }

  /** POST `/api/configuracao/admin/calendarios-dias-uteis/{id}/dias-nao-uteis` — acrescenta um dia não útil a um calendário já existente. Idempotency-Key obrigatório (ADR-0027). */
  criaNovaData(
    id: string,
    command: DiaNaoUtilCommandItem,
    context: HttpContext,
  ): Observable<ApiResult<CalendarioDiasUteisDto>> {
    return this.http.post<ApiResult<CalendarioDiasUteisDto>>(
      `${this.basePath}/api/configuracao/admin/calendarios-dias-uteis/${encodeURIComponent(id)}/dias-nao-uteis`,
      command,
      {
        context,
        headers: new HttpHeaders({ Accept: 'application/json' }),
      },
    );
  }
}
