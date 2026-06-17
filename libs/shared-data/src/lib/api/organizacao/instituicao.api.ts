import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { ORGANIZACAO_BASE_PATH } from './tokens';

export type InstituicaoDto = components['schemas']['InstituicaoDto'];
export type CriarInstituicaoCommand = components['schemas']['CriarInstituicaoCommand'];
export type AtualizarInstituicaoCommand = components['schemas']['AtualizarInstituicaoCommand'];

/**
 * Cliente Angular standalone do recurso Instituição (módulo Organização
 * Institucional). A Instituição é **singleton** (ADR-0055): não há listagem nem
 * seletor — há a Instituição, criada uma vez e editada ao longo do tempo. Por
 * isso `obter()` não recebe `id` (lê `GET /api/instituicao`) e devolve 404
 * quando nenhuma foi cadastrada ainda.
 *
 * API thin (ADR-0013): tipos vêm do `schema.ts` gerado, a resposta é envelopada
 * em `ApiResult<T>` pelo `apiResultInterceptor` upstream (ADR-0011), o Bearer é
 * injetado pelo `tokenInterceptor` (ADR-0009) e o versionamento por vendor MIME
 * (`application/vnd.uniplus.instituicao.v1+json`, ADR-0028 do `uniplus-api`) é
 * declarado por `withVendorMime('instituicao', 1)`. Espelha `UnidadesApi`.
 */
@Injectable({ providedIn: 'root' })
export class InstituicaoApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(ORGANIZACAO_BASE_PATH);

  /**
   * GET `/api/instituicao` — obtém o cabeçalho institucional (singleton). O
   * `apiResultInterceptor` envelopa o 404 (nenhuma Instituição viva) como
   * `ApiFailure` com `status: 404` — não lança; o caller decide o modo de tela
   * (leitura vs criação) lendo `result.status`.
   */
  obter(): Observable<ApiResult<InstituicaoDto>> {
    return this.http.get<ApiResult<InstituicaoDto>>(`${this.basePath}/api/instituicao`, {
      context: withVendorMime('instituicao', 1),
    });
  }

  /**
   * POST `/api/admin/instituicao` — cria a Instituição. Restrito a
   * `plataforma-admin`. Idempotency-Key obrigatório (ADR-0027) — declarado via
   * `withIdempotencyKey(key)` no `context`. Retorna 409
   * (`uniplus.organizacao.instituicao.ja_existe`) se já existe uma viva
   * (singleton — CA-06). Resposta 201 com body `string` (o ID); `Accept` fixado
   * em `application/json` porque o contrato também declara `text/plain` para 201.
   */
  criar(command: CriarInstituicaoCommand, context: HttpContext): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(`${this.basePath}/api/admin/instituicao`, command, {
      context,
      headers: new HttpHeaders({ Accept: 'application/json' }),
    });
  }

  /**
   * PUT `/api/admin/instituicao/{id}` — atualiza a Instituição existente.
   * Restrito a `plataforma-admin`. Idempotency-Key obrigatório (ADR-0027).
   * Resposta 204 No Content em sucesso.
   */
  atualizar(
    id: string,
    command: AtualizarInstituicaoCommand,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/admin/instituicao/${encodeURIComponent(id)}`,
      command,
      { context },
    );
  }

  /**
   * DELETE `/api/admin/instituicao/{id}` — remoção lógica (soft-delete) da
   * Instituição. Restrito a `plataforma-admin`. Sem Idempotency-Key (o backend
   * não exige o header). Resposta 204 No Content; libera o cadastro de uma nova
   * Instituição.
   */
  remover(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.basePath}/api/admin/instituicao/${encodeURIComponent(id)}`,
    );
  }
}
