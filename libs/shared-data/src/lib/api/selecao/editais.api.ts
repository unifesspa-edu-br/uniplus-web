import {
  HttpClient,
  HttpContext,
  HttpHeaders,
  HttpParams,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ApiResult,
  Cursor,
  IDEMPOTENCY_KEY_TOKEN,
  cursorToString,
  withVendorMime,
} from '@uniplus/shared-core';
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

  /**
   * GET `/api/editais` — lista paginada por cursor opaco (ADR-0026 + ADR-0031
   * do `uniplus-api`; consumer client-side via ADR-0015).
   *
   * Parâmetros opcionais:
   * - `cursor`: cursor opaco emitido pelo servidor no header `Link rel="next"`
   *   da página anterior. Ausente na 1ª página.
   * - `limit`: tamanho máximo da janela. Ausente => default do servidor.
   *
   * O cursor é serializado no query param `cursor=`; o cliente nunca decifra
   * o conteúdo (ADR-0031 do backend). Use `extractNextCursor(result.headers
   * .get('Link'))` para obter o próximo cursor a partir do header de resposta.
   */
  listar(cursor?: Cursor, limit?: number): Observable<ApiResult<readonly EditalDto[]>> {
    let params = new HttpParams();
    if (cursor !== undefined) {
      params = params.set('cursor', cursorToString(cursor));
    }
    if (limit !== undefined) {
      params = params.set('limit', String(limit));
    }
    return this.http.get<ApiResult<readonly EditalDto[]>>(
      `${this.basePath}/api/editais`,
      { context: withVendorMime('edital', 1), params },
    );
  }

  /** GET `/api/editais/{id}` — detalhe de um edital. */
  obter(id: string): Observable<ApiResult<EditalDto>> {
    return this.http.get<ApiResult<EditalDto>>(
      `${this.basePath}/api/editais/${encodeURIComponent(id)}`,
      { context: withVendorMime('edital', 1) },
    );
  }

  /**
   * POST `/api/editais` — cria um novo edital.
   *
   * **Header obrigatório:** `Idempotency-Key` (ADR-0027 do `uniplus-api`,
   * ADR-0014 do consumer). O caller declara via `withIdempotencyKey(key)` ou
   * compõe num `HttpContext` próprio (ex.: `withIdempotencyKey(key).set(...)`).
   * Sem o header, o backend rejeita com `400 uniplus.idempotency.key_ausente`.
   *
   * **Resposta 201:** body é `string` (o ID do recurso criado); header
   * `Location` aponta para o detalhe (ADR-0029). Replays válidos com a mesma
   * key + body idêntico recebem a resposta original cacheada com
   * `Idempotency-Replayed: true` (ADR-0027).
   *
   * **Accept fixado em `application/json`** porque o contrato declara também
   * `text/plain` para 201 — sem Accept explícito, Angular envia
   * `application/json, text/plain` (mais o wildcard genérico) e um 201 com
   * `text/plain` body `<id>` (sem aspas) faria `responseType: 'json'` lançar
   * JSON parse error em sucesso legítimo. Forçar JSON garante que o body
   * chega como `string` JSON-decodificada.
   */
  criar(
    command: CriarEditalCommand,
    context: HttpContext,
  ): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(
      `${this.basePath}/api/editais`,
      command,
      {
        context,
        headers: new HttpHeaders({ Accept: 'application/json' }),
      },
    );
  }

  /**
   * POST `/api/editais/{id}/publicar` — publica um edital em rascunho.
   *
   * **Header obrigatório:** `Idempotency-Key` (ADR-0027 do `uniplus-api`).
   * O caller declara via `withIdempotencyKey(key)` no `HttpContext`; este
   * método compõe `withVendorMime('edital', 1)` no contexto recebido para
   * declarar a versão do recurso (ADR-0028 backend, ADR-0016 cliente),
   * mantendo simetria com `obter()` e `listar()`.
   *
   * **Resposta 204 No Content** em sucesso (sem body — vendor MIME não
   * afeta o parse, mas é mantido por consistência de versionamento do recurso).
   * **422 `uniplus.selecao.edital.ja_publicado`** quando o edital já está publicado.
   */
  publicar(id: string, context: HttpContext): Observable<ApiResult<void>> {
    const idempotencyKeyValue = context.get(IDEMPOTENCY_KEY_TOKEN);
    const ctxComposto = withVendorMime('edital', 1).set(
      IDEMPOTENCY_KEY_TOKEN,
      idempotencyKeyValue,
    );
    return this.http.post<ApiResult<void>>(
      `${this.basePath}/api/editais/${encodeURIComponent(id)}/publicar`,
      null,
      { context: ctxComposto },
    );
  }
}
