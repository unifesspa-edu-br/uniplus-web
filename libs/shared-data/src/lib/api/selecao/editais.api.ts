import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core';
import type { components } from './schema';
import { SELECAO_BASE_PATH } from './tokens';

/**
 * DTOs do módulo Seleção tipados a partir do contrato V1
 * (`contracts/openapi.selecao.json` da `uniplus-api`), gerados em `schema.ts`
 * via `openapi-typescript` (ADR-0013). Consumers devem importar daqui em vez
 * de declarar shapes locais.
 *
 * IMPORTANTE: o schema gerado também contém
 * `components['schemas']['ProblemDetails']` (RFC 7807 default da .NET) —
 * **não use** esse tipo. O wire format real RFC 9457 + extensions Uni+ vive
 * em `@uniplus/shared-core` (ADR-0011 + ADR-0023 do `uniplus-api`).
 */
export type EditalDto = components['schemas']['EditalDto'];
export type CriarEditalCommand = components['schemas']['CriarEditalCommand'];

/**
 * Cliente Angular standalone do recurso `/api/editais` (módulo Seleção).
 * Pattern thin (ADR-0013): tipos vêm do `schema.ts` gerado, response é
 * envelopada em `ApiResult<T>` pelo `apiResultInterceptor` upstream
 * (ADR-0011), Bearer é injetado pelo `tokenInterceptor` (ADR-0009),
 * versionamento via vendor MIME `application/vnd.uniplus.edital.v1+json`
 * (ADR-0028 do `uniplus-api`) é declarado por `withVendorMime('edital', 1)`.
 *
 * Métodos `criar()` e `publicar()` ficam para PRs subsequentes — `criar`
 * depende do helper `withIdempotencyKey` (Frente 3) e `publicar` depende dos
 * `_links` HATEOAS (Frente 8).
 */
@Injectable({ providedIn: 'root' })
export class EditaisApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(SELECAO_BASE_PATH);

  /** GET `/api/editais` — lista de editais (sem cursor pagination até a Frente 4). */
  listar(): Observable<ApiResult<readonly EditalDto[]>> {
    return this.http.get<ApiResult<readonly EditalDto[]>>(
      `${this.basePath}/api/editais`,
      { context: withVendorMime('edital', 1) },
    );
  }

  /** GET `/api/editais/{id}` — detalhe de um edital. */
  obter(id: string): Observable<ApiResult<EditalDto>> {
    return this.http.get<ApiResult<EditalDto>>(
      `${this.basePath}/api/editais/${encodeURIComponent(id)}`,
      { context: withVendorMime('edital', 1) },
    );
  }
}
