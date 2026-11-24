import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime, janelaDaPagina } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type ModalidadeDto = components['schemas']['ModalidadeDto'];
export type CriarModalidadeCommand = components['schemas']['CriarModalidadeCommand'];
export type AtualizarModalidadeCommand = components['schemas']['AtualizarModalidadeCommand'];

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
    return this.http.get<ApiResult<readonly ModalidadeDto[]>>(
      `${this.basePath}/api/configuracao/modalidades`,
      { params: janelaDaPagina(new HttpParams(), query), context: withVendorMime('modalidade', 1) },
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
