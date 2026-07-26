import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import { TipoUnidade } from './schema';
import { ORGANIZACAO_BASE_PATH } from './tokens';
import type { components } from './schema';

export type UnidadeDto = components['schemas']['UnidadeDto'];
export type CriarUnidadeCommand = components['schemas']['CriarUnidadeCommand'];
export type AtualizarUnidadeCommand = components['schemas']['AtualizarUnidadeCommand'];
export { TipoUnidade };

export interface UnidadeTipoOption {
  readonly value: TipoUnidade;
  readonly label: string;
}

export const TIPOS_UNIDADE: readonly UnidadeTipoOption[] = [
  { value: TipoUnidade.reitoria, label: 'Reitoria' },
  { value: TipoUnidade.proReitoria, label: 'Pró-Reitoria' },
  { value: TipoUnidade.centro, label: 'Centro' },
  { value: TipoUnidade.instituto, label: 'Instituto' },
  { value: TipoUnidade.faculdade, label: 'Faculdade' },
  { value: TipoUnidade.departamento, label: 'Departamento' },
  { value: TipoUnidade.coordenacao, label: 'Coordenação' },
  { value: TipoUnidade.diretoria, label: 'Diretoria' },
  { value: TipoUnidade.divisao, label: 'Divisão' },
  { value: TipoUnidade.nucleo, label: 'Núcleo' },
  { value: TipoUnidade.outro, label: 'Outro' },
] as const;

@Injectable({ providedIn: 'root' })
export class UnidadesApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(ORGANIZACAO_BASE_PATH);

  obter(id: string): Observable<ApiResult<UnidadeDto>> {
    return this.http.get<ApiResult<UnidadeDto>>(
      `${this.basePath}/api/organizacao/unidades/${encodeURIComponent(id)}`,
      { context: withVendorMime('unidade', 1) },
    );
  }

  criar(command: CriarUnidadeCommand, context: HttpContext): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(`${this.basePath}/api/organizacao/admin/unidades`, command, {
      context,
      headers: new HttpHeaders({ Accept: 'application/json' }),
    });
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
