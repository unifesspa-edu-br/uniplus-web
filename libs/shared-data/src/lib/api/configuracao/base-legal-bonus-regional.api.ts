import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type BaseLegalBonusRegionalDto = components['schemas']['BaseLegalBonusRegionalDto'];
export type BaseLegalBonusRegionalMunicipioDto =
  components['schemas']['BaseLegalBonusRegionalMunicipioDto'];
export type CriarBaseLegalBonusRegionalCommand =
  components['schemas']['CriarBaseLegalBonusRegionalCommand'];
export type CriarBaseLegalBonusRegionalMunicipioCommand =
  components['schemas']['CriarBaseLegalBonusRegionalMunicipioCommand'];
export type AtualizarBaseLegalBonusRegionalCommand =
  components['schemas']['AtualizarBaseLegalBonusRegionalCommand'];

/** Filtro de listagem de Base Legal de Bônus Regional (cursor pagination, ADR-0026). */
export interface BaseLegalBonusRegionalQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

/**
 * Cliente Angular standalone do cadastro de Base Legal de Bônus Regional
 * (módulo Configuração): o documento formal (Lei/Decreto/Portaria/Resolução/
 * Instrução Normativa/Parecer) e os municípios que ele beneficia. O Passo 8
 * (Bônus) do Processo Seletivo congela um snapshot deste cadastro no momento
 * da configuração — editar ou desativar aqui não altera processos já
 * configurados.
 *
 * API thin (ADR-0013): tipos do `schema.ts` gerado; resposta envelopada em
 * `ApiResult<T>` (ADR-0011); versionamento por vendor MIME
 * `base-legal-bonus-regional v1` (ADR-0016/0028). Espelha `TiposDocumentoApi`.
 */
@Injectable({ providedIn: 'root' })
export class BaseLegalBonusRegionalApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** GET `/api/configuracao/base-legal-bonus-regional` — lista paginada por cursor (ADR-0026). */
  listar(
    query: BaseLegalBonusRegionalQuery = {},
  ): Observable<ApiResult<readonly BaseLegalBonusRegionalDto[]>> {
    let params = new HttpParams();
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
    } else {
      params = params.set('limit', String(query.limit ?? 100));
    }
    return this.http.get<ApiResult<readonly BaseLegalBonusRegionalDto[]>>(
      `${this.basePath}/api/configuracao/base-legal-bonus-regional`,
      { params, context: withVendorMime('base-legal-bonus-regional', 1) },
    );
  }

  /** GET `/api/configuracao/base-legal-bonus-regional/{id}` — detalhe de uma Base Legal. */
  obter(id: string): Observable<ApiResult<BaseLegalBonusRegionalDto>> {
    return this.http.get<ApiResult<BaseLegalBonusRegionalDto>>(
      `${this.basePath}/api/configuracao/base-legal-bonus-regional/${encodeURIComponent(id)}`,
      { context: withVendorMime('base-legal-bonus-regional', 1) },
    );
  }

  /** POST `/api/configuracao/admin/base-legal-bonus-regional` — cria uma Base Legal. Idempotency-Key obrigatório (ADR-0027). */
  criar(
    command: CriarBaseLegalBonusRegionalCommand,
    context: HttpContext,
  ): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(
      `${this.basePath}/api/configuracao/admin/base-legal-bonus-regional`,
      command,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /** PUT `/api/configuracao/admin/base-legal-bonus-regional/{id}` — atualiza uma Base Legal. */
  atualizar(
    id: string,
    command: AtualizarBaseLegalBonusRegionalCommand,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/base-legal-bonus-regional/${encodeURIComponent(id)}`,
      command,
      { context },
    );
  }

  /** DELETE `/api/configuracao/admin/base-legal-bonus-regional/{id}` — inativação (soft-delete). */
  remover(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/base-legal-bonus-regional/${encodeURIComponent(id)}`,
    );
  }
}
