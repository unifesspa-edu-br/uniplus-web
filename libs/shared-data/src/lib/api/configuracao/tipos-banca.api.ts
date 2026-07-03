import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type TipoBancaDto = components['schemas']['TipoBancaDto'];
export type CriarTipoBancaCommand = components['schemas']['CriarTipoBancaCommand'];
export type AtualizarTipoBancaCommand = components['schemas']['AtualizarTipoBancaCommand'];

/** Filtro de listagem de Tipos de banca (cursor pagination, ADR-0026). */
export interface TiposBancaQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

/**
 * Código canônico dos 4 tipos de banca fixos (UNI-REQ-0064). Roster fechado —
 * usado só pelo `select` de criação; a edição trata `codigo` como imutável.
 */
export const CODIGOS_TIPO_BANCA = [
  'BANCA_ANALISE_DOCUMENTAL',
  'BANCA_ENTREVISTA',
  'BANCA_CORRECAO_REDACOES',
  'BANCA_ANALISE_RECURSOS',
] as const;

export type CodigoTipoBanca = (typeof CODIGOS_TIPO_BANCA)[number];

/**
 * Cliente Angular standalone do recurso Tipo de banca (módulo Configuração).
 * Vocabulário fechado de cronograma — código imutável após a criação
 * (`Atualizar*Command` não aceita `codigo`). `faseTipica` é texto livre
 * orientativo, sem FK com Fase canônica (UNI-REQ-0064).
 *
 * API thin (ADR-0013): tipos do `schema.ts` gerado; resposta envelopada em
 * `ApiResult<T>` (ADR-0011); versionamento por vendor MIME `tipo-banca v1`
 * (ADR-0016). Espelha `FasesCanonicasApi`/`CampiApi`.
 */
@Injectable({ providedIn: 'root' })
export class TiposBancaApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** GET `/api/configuracao/tipos-banca` — lista paginada por cursor (ADR-0026). */
  listar(query: TiposBancaQuery = {}): Observable<ApiResult<readonly TipoBancaDto[]>> {
    let params = new HttpParams();
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
    } else {
      params = params.set('limit', String(query.limit ?? 100));
    }
    return this.http.get<ApiResult<readonly TipoBancaDto[]>>(
      `${this.basePath}/api/configuracao/tipos-banca`,
      { params, context: withVendorMime('tipo-banca', 1) },
    );
  }

  /** GET `/api/configuracao/tipos-banca/{id}` — detalhe de um Tipo de banca. */
  obter(id: string): Observable<ApiResult<TipoBancaDto>> {
    return this.http.get<ApiResult<TipoBancaDto>>(
      `${this.basePath}/api/configuracao/tipos-banca/${encodeURIComponent(id)}`,
      { context: withVendorMime('tipo-banca', 1) },
    );
  }

  /** POST `/api/configuracao/admin/tipos-banca` — cria. Idempotency-Key obrigatório. */
  criar(command: CriarTipoBancaCommand, context: HttpContext): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(
      `${this.basePath}/api/configuracao/admin/tipos-banca`,
      command,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /** PUT `/api/configuracao/admin/tipos-banca/{id}` — atualiza (sem `codigo`, imutável). */
  atualizar(
    id: string,
    command: AtualizarTipoBancaCommand,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/tipos-banca/${encodeURIComponent(id)}`,
      command,
      { context },
    );
  }

  /** DELETE `/api/configuracao/admin/tipos-banca/{id}` — remoção lógica (soft-delete). */
  remover(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/tipos-banca/${encodeURIComponent(id)}`,
    );
  }
}
