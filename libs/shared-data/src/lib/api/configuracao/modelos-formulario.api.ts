import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ApiResult,
  Cursor,
  coletarPaginas,
  cursorToString,
  withVendorMime,
} from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type ModeloFormularioView = components['schemas']['ModeloFormularioView'];
export type FormularioRenderizavel = components['schemas']['FormularioRenderizavel'];
export type CriarModeloFormularioCommand = components['schemas']['CriarModeloFormularioCommand'];
export type EdicaoDoModeloInput = components['schemas']['EdicaoDoModeloInput'];
export type ConteudoDoModeloInput = components['schemas']['ConteudoDoModeloInput'];
/**
 * Os filtros da listagem: o tipo de processo traz os modelos que servem a ele, inclusive os que
 * servem a todos os tipos; a finalidade é o token canônico.
 */
export interface ModelosFormularioQuery {
  readonly tipoProcesso?: string;
  readonly finalidade?: string;
  readonly ativo?: boolean;
  readonly limit?: number;
  /** O cursor do `rel="next"` da página anterior; ausente na primeira. */
  readonly cursor?: Cursor;
}

/**
 * Cliente dos modelos de formulário: o formulário composto por tipo de processo e finalidade
 * que o processo copia ao partir de um modelo (ADR-0136, UNI-REQ-0144).
 *
 * A listagem paginada da manutenção é lida pela página com `useApiResource`; aqui ficam a
 * listagem filtrada por página e por inteiro, para quem oferece a escolha de um modelo, a leitura
 * de um modelo e as escritas. O PUT substitui o conteúdo inteiro, e o DELETE desativa — o modelo
 * desativado deixa de ser oferecido a processo novo, e a ativação o devolve.
 *
 * API thin (ADR-0013): tipos do `schema.ts` gerado; resposta envelopada em `ApiResult<T>`;
 * versionamento por vendor MIME; escritas com Idempotency-Key no `context` (ADR-0027).
 */
@Injectable({ providedIn: 'root' })
export class ModelosFormularioApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /**
   * GET `/api/configuracao/admin/modelos-formulario` — uma página da listagem filtrada: a primeira,
   * ou a do cursor. Para oferecer a escolha de um modelo, {@link listarTodos}.
   */
  listar(
    query: ModelosFormularioQuery = {},
  ): Observable<ApiResult<readonly ModeloFormularioView[]>> {
    let params =
      query.cursor === undefined
        ? new HttpParams().set('limit', String(query.limit ?? 100))
        : new HttpParams().set('cursor', cursorToString(query.cursor)).set('direction', 'next');
    if (query.tipoProcesso !== undefined) params = params.set('tipoProcesso', query.tipoProcesso);
    if (query.finalidade !== undefined) params = params.set('finalidade', query.finalidade);
    if (query.ativo !== undefined) params = params.set('ativo', String(query.ativo));
    return this.http.get<ApiResult<readonly ModeloFormularioView[]>>(this.admin(), {
      params,
      context: withVendorMime('modelo-formulario', 1),
    });
  }

  /**
   * Todos os modelos da listagem filtrada, seguindo o cursor até a última página: a escolha de um
   * modelo só oferece o que conhece. A primeira recusa é entregue como está, sem lista parcial.
   */
  listarTodos(
    query: Omit<ModelosFormularioQuery, 'cursor'> = {},
  ): Observable<ApiResult<readonly ModeloFormularioView[]>> {
    return coletarPaginas((cursor) => this.listar({ ...query, cursor }));
  }

  /** GET `/api/configuracao/admin/modelos-formulario/{id}` — o modelo com o conteúdo. */
  obter(id: string): Observable<ApiResult<ModeloFormularioView>> {
    return this.http.get<ApiResult<ModeloFormularioView>>(this.admin(id), {
      context: withVendorMime('modelo-formulario', 1),
    });
  }

  /** POST `/api/configuracao/admin/modelos-formulario` — cria o modelo, já ativo. */
  criar(
    command: CriarModeloFormularioCommand,
    context: HttpContext,
  ): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(this.admin(), command, {
      context,
      headers: ACEITA_JSON,
    });
  }

  /** PUT `/api/configuracao/admin/modelos-formulario/{id}` — substitui nome, descrição, tipo de processo e conteúdo. */
  atualizar(
    id: string,
    input: EdicaoDoModeloInput,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(this.admin(id), input, { context });
  }

  /** DELETE `/api/configuracao/admin/modelos-formulario/{id}` — desativa: deixa de ser oferecido a processo novo. */
  desativar(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(this.admin(id));
  }

  /** POST `/api/configuracao/admin/modelos-formulario/{id}/ativacao` — reativa o modelo. */
  ativar(id: string, context: HttpContext): Observable<ApiResult<void>> {
    return this.http.post<ApiResult<void>>(this.admin(id, 'ativacao'), null, { context });
  }

  /**
   * GET `/api/configuracao/admin/modelos-formulario/{id}/renderizavel` — o modelo no formato que o
   * candidato veria, com as regras que o interpretador avalia, para a simulação antes de aplicá-lo.
   */
  obterRenderizavel(id: string): Observable<ApiResult<FormularioRenderizavel>> {
    return this.http.get<ApiResult<FormularioRenderizavel>>(this.admin(id, 'renderizavel'), {
      context: withVendorMime('formulario', 2),
    });
  }

  private admin(...segmentos: readonly string[]): string {
    return [
      `${this.basePath}/api/configuracao/admin/modelos-formulario`,
      ...segmentos.map(encodeURIComponent),
    ].join('/');
  }
}

const ACEITA_JSON = new HttpHeaders({ Accept: 'application/json' });
