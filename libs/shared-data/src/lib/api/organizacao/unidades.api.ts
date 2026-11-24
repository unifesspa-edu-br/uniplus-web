import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime, janelaDaPagina } from '@uniplus/shared-core/http';
import { TipoUnidadeCodigo } from './schema';
import { ORGANIZACAO_BASE_PATH } from './tokens';
import type { components } from './schema';

export type UnidadeDto = Omit<components['schemas']['UnidadeDto'], 'tipo'> & {
  readonly tipo: TipoUnidadeCodigo;
};
export type CriarUnidadeCommand = components['schemas']['CriarUnidadeCommand'];
export type AtualizarUnidadeCommand = components['schemas']['AtualizarUnidadeCommand'];
export { TipoUnidadeCodigo };

/** Filtro da listagem paginada de unidades (cursor opaco, ADR-0026). */
export interface UnidadesQuery {
  /** Busca textual por nome, sigla ou código. */
  readonly q?: string;
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

export interface UnidadeTipoOption {
  readonly value: TipoUnidadeCodigo;
  readonly label: string;
}

export const TIPOS_UNIDADE: readonly UnidadeTipoOption[] = [
  { value: TipoUnidadeCodigo.REITORIA, label: 'Reitoria' },
  { value: TipoUnidadeCodigo.PRO_REITORIA, label: 'Pró-Reitoria' },
  { value: TipoUnidadeCodigo.CENTRO, label: 'Centro' },
  { value: TipoUnidadeCodigo.INSTITUTO, label: 'Instituto' },
  { value: TipoUnidadeCodigo.FACULDADE, label: 'Faculdade' },
  { value: TipoUnidadeCodigo.DEPARTAMENTO, label: 'Departamento' },
  { value: TipoUnidadeCodigo.COORDENACAO, label: 'Coordenação' },
  { value: TipoUnidadeCodigo.DIRETORIA, label: 'Diretoria' },
  { value: TipoUnidadeCodigo.DIVISAO, label: 'Divisão' },
  { value: TipoUnidadeCodigo.NUCLEO, label: 'Núcleo' },
  { value: TipoUnidadeCodigo.OUTRO, label: 'Outro' },
] as const;

@Injectable({ providedIn: 'root' })
export class UnidadesApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(ORGANIZACAO_BASE_PATH);

  /** GET `/api/organizacao/unidades` — paginação por cursor opaco. */
  listar(query: UnidadesQuery = {}): Observable<ApiResult<readonly UnidadeDto[]>> {
    let params = new HttpParams();
    if (query.q !== undefined) {
      params = params.set('q', query.q);
    }

    return this.http.get<ApiResult<readonly UnidadeDto[]>>(
      `${this.basePath}/api/organizacao/unidades`,
      { params: janelaDaPagina(params, query), context: withVendorMime('unidade', 1) },
    );
  }

  obter(id: string): Observable<ApiResult<UnidadeDto>> {
    return this.http.get<ApiResult<UnidadeDto>>(
      `${this.basePath}/api/organizacao/unidades/${encodeURIComponent(id)}`,
      { context: withVendorMime('unidade', 1) },
    );
  }

  criar(command: CriarUnidadeCommand, context: HttpContext): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(
      `${this.basePath}/api/organizacao/admin/unidades`,
      command,
      {
        context,
        headers: new HttpHeaders({ Accept: 'application/json' }),
      },
    );
  }

  atualizar(
    id: string,
    command: AtualizarUnidadeCommand,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/organizacao/admin/unidades/${encodeURIComponent(id)}`,
      command,
      { context },
    );
  }

  remover(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.basePath}/api/organizacao/admin/unidades/${encodeURIComponent(id)}`,
    );
  }
}
