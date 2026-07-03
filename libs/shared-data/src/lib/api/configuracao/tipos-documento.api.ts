import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type TipoDocumentoDto = components['schemas']['TipoDocumentoDto'];
export type CriarTipoDocumentoCommand = components['schemas']['CriarTipoDocumentoCommand'];
export type AtualizarTipoDocumentoCommand = components['schemas']['AtualizarTipoDocumentoCommand'];

/** Opção de categoria de documento (domínio fechado, 7 valores). */
export interface CategoriaDocumentoOption {
  readonly value: string;
  readonly label: string;
}

/**
 * As 7 categorias de `CategoriaDocumento` — vocabulário de referência (enum
 * fechado no backend, exposto como `string` no contrato). Espelha
 * `GRUPOS_AREA_ENEM` de `CursosApi`.
 */
export const CATEGORIAS_DOCUMENTO: readonly CategoriaDocumentoOption[] = [
  { value: 'IDENTIFICACAO', label: 'Identificação' },
  { value: 'ESCOLARIDADE', label: 'Escolaridade' },
  { value: 'RENDA', label: 'Renda' },
  { value: 'RACA_ETNIA', label: 'Raça/etnia' },
  { value: 'SAUDE', label: 'Saúde' },
  { value: 'RESIDENCIA', label: 'Residência' },
  { value: 'OUTROS', label: 'Outros' },
] as const;

/** Filtro de listagem de Tipos de Documento (cursor pagination, ADR-0026). */
export interface TiposDocumentoQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

/**
 * Cliente Angular standalone do recurso Tipo de Documento (módulo
 * Configuração). Cadastro classificatório puro — sem FK para outras
 * entidades cadastrais; `tipoEquivalente` é só um rótulo textual (não
 * referência), congelado por snapshot na configuração de exigência
 * documental do edital (RN08, fora desta tela).
 *
 * API thin (ADR-0013): tipos do `schema.ts` gerado; resposta envelopada em
 * `ApiResult<T>` (ADR-0011); versionamento por vendor MIME `tipo-documento
 * v1` (ADR-0016/0028). Espelha `CursosApi`/`CampiApi`.
 */
@Injectable({ providedIn: 'root' })
export class TiposDocumentoApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** GET `/api/configuracao/tipos-documento` — lista paginada por cursor (ADR-0026). */
  listar(query: TiposDocumentoQuery = {}): Observable<ApiResult<readonly TipoDocumentoDto[]>> {
    let params = new HttpParams();
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
    } else {
      params = params.set('limit', String(query.limit ?? 100));
    }
    return this.http.get<ApiResult<readonly TipoDocumentoDto[]>>(
      `${this.basePath}/api/configuracao/tipos-documento`,
      { params, context: withVendorMime('tipo-documento', 1) },
    );
  }

  /** GET `/api/configuracao/tipos-documento/{id}` — detalhe de um Tipo de Documento. */
  obter(id: string): Observable<ApiResult<TipoDocumentoDto>> {
    return this.http.get<ApiResult<TipoDocumentoDto>>(
      `${this.basePath}/api/configuracao/tipos-documento/${encodeURIComponent(id)}`,
      { context: withVendorMime('tipo-documento', 1) },
    );
  }

  /** POST `/api/configuracao/admin/tipos-documento` — cria um Tipo de Documento. Idempotency-Key obrigatório (ADR-0027). */
  criar(command: CriarTipoDocumentoCommand, context: HttpContext): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(
      `${this.basePath}/api/configuracao/admin/tipos-documento`,
      command,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /** PUT `/api/configuracao/admin/tipos-documento/{id}` — atualiza um Tipo de Documento (código reeditável). */
  atualizar(
    id: string,
    command: AtualizarTipoDocumentoCommand,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/tipos-documento/${encodeURIComponent(id)}`,
      command,
      { context },
    );
  }

  /** DELETE `/api/configuracao/admin/tipos-documento/{id}` — inativação (soft-delete); sem bloqueio por referência externa (RN08/ADR-0061). */
  remover(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/tipos-documento/${encodeURIComponent(id)}`,
    );
  }
}
