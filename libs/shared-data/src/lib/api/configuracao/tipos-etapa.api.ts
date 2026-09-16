import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type TipoEtapaDto = components['schemas']['TipoEtapaDto'];
export type CriarTipoEtapaCommand = components['schemas']['CriarTipoEtapaCommand'];
export type AtualizarTipoEtapaCommand = components['schemas']['AtualizarTipoEtapaCommand'];

/** Filtro da listagem de tipos de etapa (cursor pagination, ADR-0026). */
export interface TiposEtapaQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

/**
 * Cliente de leitura do catálogo de tipos de etapa.
 *
 * É de onde a etapa pontuada de um Processo Seletivo tira o
 * `tipoEtapaOrigemId`: a API resolve esse id contra o cadastro vivo e congela um
 * snapshot independente do rótulo editorial da etapa, recusando com
 * `TipoEtapaNaoEncontradoOuInativo` o que não existe ou não está ativo.
 *
 * **A listagem não filtra por atividade** — o endpoint aceita só paginação, e
 * devolve ativos e inativos juntos. A separação é de quem consome, e ela tem
 * duas metades: um tipo inativo não pode ser oferecido como escolha nova, mas
 * precisa continuar visível quando já referenciado por uma etapa gravada, senão
 * a tela exibiria um vínculo existente sem rótulo.
 *
 * Cada tipo declara também se admite compor a nota final e se admite eliminar
 * candidato. É desse par que o wizard tira quais caracteres oferecer numa etapa
 * daquele tipo — e, por consequência, se ela pode ter peso e nota mínima.
 */
@Injectable({ providedIn: 'root' })
export class TiposEtapaApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** GET `/api/configuracao/tipos-etapa` — lista paginada por cursor (ADR-0026). */
  listar(query: TiposEtapaQuery = {}): Observable<ApiResult<readonly TipoEtapaDto[]>> {
    let params = new HttpParams();
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
    } else {
      params = params.set('limit', String(query.limit ?? 100));
    }

    return this.http.get<ApiResult<readonly TipoEtapaDto[]>>(
      `${this.basePath}/api/configuracao/tipos-etapa`,
      { params, context: withVendorMime('tipo-etapa', 1) },
    );
  }

  /** GET `/api/configuracao/tipos-etapa/{id}` — detalhe de um tipo de etapa. */
  obter(id: string): Observable<ApiResult<TipoEtapaDto>> {
    return this.http.get<ApiResult<TipoEtapaDto>>(
      `${this.basePath}/api/configuracao/tipos-etapa/${encodeURIComponent(id)}`,
      { context: withVendorMime('tipo-etapa', 1) },
    );
  }

  /** POST `/api/configuracao/admin/tipos-etapa` — cria. Idempotency-Key obrigatório. */
  criar(command: CriarTipoEtapaCommand, context: HttpContext): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(
      `${this.basePath}/api/configuracao/admin/tipos-etapa`,
      command,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /** PUT `/api/configuracao/admin/tipos-etapa/{id}` — atualiza (sem `codigo`, imutável). */
  atualizar(
    id: string,
    command: AtualizarTipoEtapaCommand,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/tipos-etapa/${encodeURIComponent(id)}`,
      command,
      { context },
    );
  }

  /** DELETE `/api/configuracao/admin/tipos-etapa/{id}` — desativa; o código fica reservado. */
  remover(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/tipos-etapa/${encodeURIComponent(id)}`,
    );
  }
}
