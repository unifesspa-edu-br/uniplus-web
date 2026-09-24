import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

/** Grupo de área do ENEM: código estável e rótulo oficial, ambos postos pela API. */
export type GrupoAreaEnemDto = components['schemas']['GrupoAreaEnemDto'];

/**
 * Cliente Angular standalone do vocabulário fechado de Grupo de área do ENEM
 * (módulo Configuração) — os grupos de curso do Anexo I da Resolução nº
 * 805/2024/Consepe. Cursos e Pesos por Área gravam o grupo pelo código e
 * mostram o rótulo; o front não duplica a lista.
 *
 * API thin (ADR-0013): tipos do `schema.ts` gerado; resposta envelopada em
 * `ApiResult<T>` (ADR-0011); versionamento por vendor MIME
 * `codigo-grupo-area-enem v1` (ADR-0016/0028).
 */
@Injectable({ providedIn: 'root' })
export class GruposAreaEnemApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /**
   * GET `/api/configuracao/vocabularios/grupos-area-enem` — os grupos, na ordem
   * em que a tela os apresenta. Conjunto fechado: sem paginação.
   */
  listar(): Observable<ApiResult<readonly GrupoAreaEnemDto[]>> {
    return this.http.get<ApiResult<readonly GrupoAreaEnemDto[]>>(
      `${this.basePath}/api/configuracao/vocabularios/grupos-area-enem`,
      { context: withVendorMime('codigo-grupo-area-enem', 1) },
    );
  }
}
