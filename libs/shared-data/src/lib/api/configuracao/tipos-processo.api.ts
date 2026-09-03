import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type TipoProcessoDto = components['schemas']['TipoProcessoDto'];
export type CriarTipoProcessoCommand = components['schemas']['CriarTipoProcessoCommand'];
export type AtualizarTipoProcessoCommand = components['schemas']['AtualizarTipoProcessoCommand'];

/** Filtro da listagem pública paginada de tipos ativos (cursor opaco, ADR-0026). */
export interface TiposProcessoQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

/**
 * Filtro da listagem de manutenção (`admin/tipos-processo`). `apenasAtivos`
 * default `false` no contrato — a tela de cadastro traz ativos e desativados
 * para permitir a reativação.
 */
export interface TiposProcessoManutencaoQuery extends TiposProcessoQuery {
  readonly apenasAtivos?: boolean;
}

/**
 * Cliente Angular standalone do recurso Tipo de Processo Seletivo (módulo
 * Configuração, UNI-REQ-0098).
 *
 * Leitura pública (`GET`) devolve **somente itens ativos**; consumidores de
 * Seleção guardam o `id` retornado ao criar um Processo Seletivo, sem manter um
 * vocabulário local dos tipos semeados (ADR-0122 da API).
 *
 * `codigo` é chave natural imutável e não reutilizável — o `AtualizarTipoProcessoCommand`
 * não o aceita, e desativar (soft-delete via `DELETE`) não libera o código.
 *
 * API thin (ADR-0013): tipos do `schema.ts` gerado; resposta envelopada em
 * `ApiResult<T>` (ADR-0011); versionamento por vendor MIME `tipo-processo v1`
 * (ADR-0016/0028) nos GET; mutação com `Idempotency-Key` (ADR-0027) via
 * `HttpContext` em POST/PUT. Espelha `TiposBancaApi`.
 */
@Injectable({ providedIn: 'root' })
export class TiposProcessoApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** GET `/api/configuracao/tipos-processo` — itens ativos, paginação por cursor opaco (ADR-0026). */
  listar(query: TiposProcessoQuery = {}): Observable<ApiResult<readonly TipoProcessoDto[]>> {
    let params = new HttpParams();
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
    } else {
      params = params.set('limit', String(query.limit ?? 100));
    }

    return this.http.get<ApiResult<readonly TipoProcessoDto[]>>(
      `${this.basePath}/api/configuracao/tipos-processo`,
      { params, context: withVendorMime('tipo-processo', 1) },
    );
  }

  /** GET `/api/configuracao/tipos-processo/{id}` — detalhe de um Tipo de Processo. */
  obter(id: string): Observable<ApiResult<TipoProcessoDto>> {
    return this.http.get<ApiResult<TipoProcessoDto>>(
      `${this.basePath}/api/configuracao/tipos-processo/${encodeURIComponent(id)}`,
      { context: withVendorMime('tipo-processo', 1) },
    );
  }

  /**
   * GET `/api/configuracao/admin/tipos-processo` — listagem de manutenção
   * (plataforma-admin), inclui os tipos desativados. Paginação por cursor
   * (ADR-0026); `apenasAtivos` default `false`.
   */
  listarParaManutencao(
    query: TiposProcessoManutencaoQuery = {},
  ): Observable<ApiResult<readonly TipoProcessoDto[]>> {
    let params = new HttpParams();
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
    } else {
      params = params.set('limit', String(query.limit ?? 100));
    }
    if (query.apenasAtivos !== undefined) {
      params = params.set('apenasAtivos', String(query.apenasAtivos));
    }

    return this.http.get<ApiResult<readonly TipoProcessoDto[]>>(
      `${this.basePath}/api/configuracao/admin/tipos-processo`,
      { params, context: withVendorMime('tipo-processo', 1) },
    );
  }

  /** POST `/api/configuracao/admin/tipos-processo` — cria. Idempotency-Key obrigatório (ADR-0027). */
  criar(command: CriarTipoProcessoCommand, context: HttpContext): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(
      `${this.basePath}/api/configuracao/admin/tipos-processo`,
      command,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /** PUT `/api/configuracao/admin/tipos-processo/{id}` — atualiza nome/descrição (código imutável). */
  atualizar(
    id: string,
    command: AtualizarTipoProcessoCommand,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/tipos-processo/${encodeURIComponent(id)}`,
      command,
      { context },
    );
  }

  /**
   * DELETE `/api/configuracao/admin/tipos-processo/{id}` — desativação (soft-delete).
   * Sem `Idempotency-Key` (o contrato não o exige). Responde 422
   * (`uniplus.configuracao.tipo_processo.ja_desativado`) quando o tipo já está
   * inativo e 409 (`...conflito_de_concorrencia`) sob alteração concorrente.
   */
  remover(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/tipos-processo/${encodeURIComponent(id)}`,
    );
  }

  /**
   * POST `/api/configuracao/admin/tipos-processo/{id}/ativacao` — reativa um tipo
   * desativado. `Idempotency-Key` obrigatório (ADR-0027). Responde 422
   * (`uniplus.configuracao.tipo_processo.ja_ativo`) quando o tipo já está ativo e
   * 409 (`...conflito_de_concorrencia`) sob alteração concorrente.
   */
  reativar(id: string, context: HttpContext): Observable<ApiResult<void>> {
    return this.http.post<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/tipos-processo/${encodeURIComponent(id)}/ativacao`,
      null,
      { context },
    );
  }
}
