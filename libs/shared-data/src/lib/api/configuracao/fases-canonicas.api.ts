import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime, janelaDaPagina } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type FaseCanonicaDto = components['schemas']['FaseCanonicaDto'];
export type AtualizarFaseCanonicaCommand = components['schemas']['AtualizarFaseCanonicaCommand'];
/** Fase do catálogo da API: código estável e nome, ambos postos pela API. */
export type FaseCanonicaVocabularioDto = components['schemas']['FaseCanonicaVocabularioDto'];

/** Filtro de listagem de Fases canônicas (cursor pagination, ADR-0026). */
export interface FasesCanonicasQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

/**
 * Origem da data da fase (UNI-REQ-0064). Domínio fechado de dois tokens, com
 * allowlist textual no backend e CHECK em `fase_canonica.origem_data`:
 * `NO_EDITAL` é data fixada no edital, com janela obrigatória; `NA_EXECUCAO` é
 * data definida na execução pela unidade responsável pela fase.
 */
export const ORIGENS_DATA_FASE = ['NO_EDITAL', 'NA_EXECUCAO'] as const;

/** Rótulo de cada origem da data, como a tela a apresenta. */
export const ROTULO_ORIGEM_DATA_FASE: Readonly<Record<OrigemDataFase, string>> = {
  NO_EDITAL: 'Fixada no edital',
  NA_EXECUCAO: 'Definida na execução',
};

export type OrigemDataFase = (typeof ORIGENS_DATA_FASE)[number];

/**
 * Cliente Angular standalone do recurso Fase canônica (módulo Configuração).
 * Vocabulário fechado de cronograma — código imutável após a criação
 * (`Atualizar*Command` não aceita `codigo`).
 *
 * API thin (ADR-0013): tipos do `schema.ts` gerado; resposta envelopada em
 * `ApiResult<T>` (ADR-0011); versionamento por vendor MIME `fase-canonica v1`
 * (ADR-0016). Espelha `CampiApi`/`CursosApi`.
 */
@Injectable({ providedIn: 'root' })
export class FasesCanonicasApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** GET `/api/configuracao/fases-canonicas` — lista paginada por cursor (ADR-0026). */
  listar(query: FasesCanonicasQuery = {}): Observable<ApiResult<readonly FaseCanonicaDto[]>> {
    return this.http.get<ApiResult<readonly FaseCanonicaDto[]>>(
      `${this.basePath}/api/configuracao/fases-canonicas`,
      {
        params: janelaDaPagina(new HttpParams(), query),
        context: withVendorMime('fase-canonica', 1),
      },
    );
  }

  /**
   * GET `/api/configuracao/vocabularios/fases-canonicas` — as fases do catálogo, na ordem em que a
   * tela as apresenta. Conjunto fechado: sem paginação.
   */
  listarVocabulario(): Observable<ApiResult<readonly FaseCanonicaVocabularioDto[]>> {
    return this.http.get<ApiResult<readonly FaseCanonicaVocabularioDto[]>>(
      `${this.basePath}/api/configuracao/vocabularios/fases-canonicas`,
      { context: withVendorMime('codigo-fase-canonica', 1) },
    );
  }

  /** PUT `/api/configuracao/admin/fases-canonicas/{id}` — atualiza (sem `codigo`, imutável). */
  atualizar(
    id: string,
    command: AtualizarFaseCanonicaCommand,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/fases-canonicas/${encodeURIComponent(id)}`,
      command,
      { context },
    );
  }

  /** DELETE `/api/configuracao/admin/fases-canonicas/{id}` — remoção lógica (soft-delete). */
  remover(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/fases-canonicas/${encodeURIComponent(id)}`,
    );
  }
}
