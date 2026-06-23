import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { TipoLocalOferta } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type LocalOfertaDto = components['schemas']['LocalOfertaDto'];
export type CriarLocalOfertaCommand = components['schemas']['CriarLocalOfertaCommand'];
export type AtualizarLocalOfertaCommand = components['schemas']['AtualizarLocalOfertaCommand'];

// O contrato expõe `TipoLocalOferta` como enum de string (codegen `--enum`);
// reexportado para consumo direto dos valores (`TipoLocalOferta.poloEad`).
export { TipoLocalOferta };

/** Opção de tipo de Local de Oferta (roster fechado do enum do contrato). */
export interface TipoLocalOfertaOption {
  readonly value: TipoLocalOferta;
  readonly label: string;
}

/** Rótulos pt-BR do enum `TipoLocalOferta` (classificação INEP/e-MEC; sem `nenhum`). */
export const TIPOS_LOCAL_OFERTA: readonly TipoLocalOfertaOption[] = [
  { value: TipoLocalOferta.campusSede, label: 'Campus sede' },
  { value: TipoLocalOferta.campusForaDeSede, label: 'Campus fora de sede' },
  { value: TipoLocalOferta.cursoForaDeSede, label: 'Curso fora de sede' },
  { value: TipoLocalOferta.poloEad, label: 'Polo EAD' },
  { value: TipoLocalOferta.convenioInteriorizacao, label: 'Convênio de interiorização' },
  { value: TipoLocalOferta.outro, label: 'Outro' },
] as const;

/** Filtro de listagem de Locais de Oferta (cursor pagination, ADR-0026). */
export interface LocaisOfertaQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

/**
 * Cliente Angular standalone do recurso Local de Oferta (módulo Configuração).
 * Possui endereço estruturado como referência ao Geo (`endereco` + `cidade`
 * aninhados, ADR-0096) e um `campusResponsavelId` opcional.
 *
 * API thin (ADR-0013): tipos do `schema.ts`; `ApiResult<T>` (ADR-0011); vendor
 * MIME `local-oferta v1` (ADR-0016/0028).
 */
@Injectable({ providedIn: 'root' })
export class LocaisOfertaApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** GET `/api/locais-oferta` — lista paginada por cursor (ADR-0026). */
  listar(query: LocaisOfertaQuery = {}): Observable<ApiResult<readonly LocalOfertaDto[]>> {
    let params = new HttpParams();
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
    } else {
      params = params.set('limit', String(query.limit ?? 100));
    }
    return this.http.get<ApiResult<readonly LocalOfertaDto[]>>(
      `${this.basePath}/api/locais-oferta`,
      { params, context: withVendorMime('local-oferta', 1) },
    );
  }

  /** GET `/api/locais-oferta/{id}` — detalhe de um Local de Oferta. */
  obter(id: string): Observable<ApiResult<LocalOfertaDto>> {
    return this.http.get<ApiResult<LocalOfertaDto>>(
      `${this.basePath}/api/locais-oferta/${encodeURIComponent(id)}`,
      { context: withVendorMime('local-oferta', 1) },
    );
  }

  /** POST `/api/admin/locais-oferta` — cria. Idempotency-Key obrigatório (ADR-0027). */
  criar(command: CriarLocalOfertaCommand, context: HttpContext): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(`${this.basePath}/api/admin/locais-oferta`, command, {
      context,
      headers: new HttpHeaders({ Accept: 'application/json' }),
    });
  }

  /** PUT `/api/admin/locais-oferta/{id}` — atualiza. */
  atualizar(
    id: string,
    command: AtualizarLocalOfertaCommand,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/admin/locais-oferta/${encodeURIComponent(id)}`,
      command,
      { context },
    );
  }

  /** DELETE `/api/admin/locais-oferta/{id}` — remoção lógica (soft-delete). */
  remover(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.basePath}/api/admin/locais-oferta/${encodeURIComponent(id)}`,
    );
  }
}
