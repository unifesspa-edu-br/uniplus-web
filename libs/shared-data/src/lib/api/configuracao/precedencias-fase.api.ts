import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type PrecedenciaFaseDto = components['schemas']['PrecedenciaFaseDto'];
export type CriarPrecedenciaFaseCommand = components['schemas']['CriarPrecedenciaFaseCommand'];
export type AtualizarPrecedenciaFaseCommand =
  components['schemas']['AtualizarPrecedenciaFaseCommand'];

/** Filtro de listagem de arestas de precedência (cursor pagination, ADR-0026). */
export interface PrecedenciasFaseQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

/**
 * Cliente Angular standalone do recurso Precedência de fase (módulo
 * Configuração). Cada registro é uma aresta do grafo de dependência entre as
 * fases canônicas do cronograma (UNI-REQ-0064): a antecessora precede a
 * sucessora, e `permiteSobreposicao` diz se as duas podem coexistir no tempo.
 *
 * O par (antecessora, sucessora) é a chave natural e é imutável — o
 * `Atualizar*Command` só aceita `permiteSobreposicao`. Para trocar o par,
 * remova a aresta e crie outra.
 *
 * API thin (ADR-0013): tipos do `schema.ts` gerado; resposta envelopada em
 * `ApiResult<T>` (ADR-0011); versionamento por vendor MIME `precedencia-fase v1`
 * (ADR-0016). Espelha `FasesCanonicasApi`.
 */
@Injectable({ providedIn: 'root' })
export class PrecedenciasFaseApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** GET `/api/configuracao/precedencias-fase` — lista paginada por cursor (ADR-0026). */
  listar(query: PrecedenciasFaseQuery = {}): Observable<ApiResult<readonly PrecedenciaFaseDto[]>> {
    let params = new HttpParams();
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
    } else {
      params = params.set('limit', String(query.limit ?? 100));
    }
    return this.http.get<ApiResult<readonly PrecedenciaFaseDto[]>>(
      `${this.basePath}/api/configuracao/precedencias-fase`,
      { params, context: withVendorMime('precedencia-fase', 1) },
    );
  }

  /** GET `/api/configuracao/precedencias-fase/{id}` — detalhe de uma aresta. */
  obter(id: string): Observable<ApiResult<PrecedenciaFaseDto>> {
    return this.http.get<ApiResult<PrecedenciaFaseDto>>(
      `${this.basePath}/api/configuracao/precedencias-fase/${encodeURIComponent(id)}`,
      { context: withVendorMime('precedencia-fase', 1) },
    );
  }

  /** POST `/api/configuracao/admin/precedencias-fase` — cria. Idempotency-Key obrigatório. */
  criar(
    command: CriarPrecedenciaFaseCommand,
    context: HttpContext,
  ): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(
      `${this.basePath}/api/configuracao/admin/precedencias-fase`,
      command,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /**
   * PUT `/api/configuracao/admin/precedencias-fase/{id}` — atualiza só
   * `permiteSobreposicao`; o par de fases é imutável. Idempotency-Key obrigatório.
   */
  atualizar(
    id: string,
    command: AtualizarPrecedenciaFaseCommand,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/precedencias-fase/${encodeURIComponent(id)}`,
      command,
      { context },
    );
  }

  /**
   * DELETE `/api/configuracao/admin/precedencias-fase/{id}` — remoção lógica.
   *
   * Sem `Idempotency-Key`: diferente de `criar`/`atualizar`, o contrato não
   * marca o DELETE como `RequiresIdempotencyKey`, e um DELETE por id já é
   * idempotente por natureza.
   */
  remover(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/precedencias-fase/${encodeURIComponent(id)}`,
    );
  }
}
