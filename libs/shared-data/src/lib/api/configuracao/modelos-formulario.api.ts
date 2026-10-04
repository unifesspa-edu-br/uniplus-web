import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type ModeloFormularioView = components['schemas']['ModeloFormularioView'];
export type CriarModeloFormularioCommand = components['schemas']['CriarModeloFormularioCommand'];
export type EdicaoDoModeloInput = components['schemas']['EdicaoDoModeloInput'];
export type ConteudoDoModeloInput = components['schemas']['ConteudoDoModeloInput'];
export type PreVisualizacaoDoModeloDto = components['schemas']['PreVisualizacaoDoModeloDto'];
export type ItemPreVisualizadoDto = components['schemas']['ItemPreVisualizadoDto'];
export type TermoPreVisualizadoDto = components['schemas']['TermoPreVisualizadoDto'];

/**
 * As respostas simuladas, por código de fato, com o valor em JSON (`true`, `18`, `"PRETA"`,
 * `["A", "B"]`). O schema gerado tipa o dicionário de `JsonElement` como `Record<string, never>`,
 * que não aceita valor nenhum; a forma aqui é a que a API recebe.
 */
export interface PreVisualizacaoDoModeloInput {
  readonly respostas: Readonly<Record<string, unknown>> | null;
  readonly etapasConcluidas: readonly string[] | null;
  readonly pressupostos: Readonly<Record<string, unknown>> | null;
}

/**
 * Cliente dos modelos de formulário: o formulário composto por tipo de processo e finalidade
 * que o processo copia ao partir de um modelo (ADR-0136, UNI-REQ-0144).
 *
 * A listagem paginada é lida pela página com `useApiResource`; aqui ficam a leitura de um
 * modelo e as escritas. O PUT substitui o conteúdo inteiro, e o DELETE desativa — o modelo
 * desativado deixa de ser oferecido a processo novo, e a ativação o devolve.
 *
 * API thin (ADR-0013): tipos do `schema.ts` gerado; resposta envelopada em `ApiResult<T>`;
 * versionamento por vendor MIME; escritas com Idempotency-Key no `context` (ADR-0027).
 */
@Injectable({ providedIn: 'root' })
export class ModelosFormularioApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** GET `/api/configuracao/admin/modelos-formulario/{id}` — o modelo com o conteúdo. */
  obter(id: string): Observable<ApiResult<ModeloFormularioView>> {
    return this.http.get<ApiResult<ModeloFormularioView>>(this.admin(id), {
      context: withVendorMime('modelo-formulario', 1),
    });
  }

  /** POST `/api/configuracao/admin/modelos-formulario` — cria o modelo, já ativo. */
  criar(command: CriarModeloFormularioCommand, context: HttpContext): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(this.admin(), command, { context, headers: ACEITA_JSON });
  }

  /** PUT `/api/configuracao/admin/modelos-formulario/{id}` — substitui nome, descrição, tipo de processo e conteúdo. */
  atualizar(id: string, input: EdicaoDoModeloInput, context: HttpContext): Observable<ApiResult<void>> {
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
   * POST `/api/configuracao/admin/modelos-formulario/{id}/pre-visualizacao` — avalia o modelo
   * gravado contra respostas simuladas. É leitura: não leva Idempotency-Key.
   */
  preVisualizar(id: string, input: PreVisualizacaoDoModeloInput): Observable<ApiResult<PreVisualizacaoDoModeloDto>> {
    return this.http.post<ApiResult<PreVisualizacaoDoModeloDto>>(this.admin(id, 'pre-visualizacao'), input, {
      context: withVendorMime('pre-visualizacao-modelo-formulario', 1),
    });
  }

  private admin(...segmentos: readonly string[]): string {
    return [`${this.basePath}/api/configuracao/admin/modelos-formulario`, ...segmentos.map(encodeURIComponent)].join('/');
  }
}

const ACEITA_JSON = new HttpHeaders({ Accept: 'application/json' });
