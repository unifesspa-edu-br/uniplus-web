import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { ORGANIZACAO_BASE_PATH } from './tokens';

export type UnidadeDto = components['schemas']['UnidadeDto'];
export type CriarUnidadeCommand = components['schemas']['CriarUnidadeCommand'];
export type AtualizarUnidadeCommand = components['schemas']['AtualizarUnidadeCommand'];
export type TipoUnidade = components['schemas']['TipoUnidade'];
export type OrigemUnidade = components['schemas']['OrigemUnidade'];

export interface UnidadeTipoOption {
  readonly value: TipoUnidade;
  readonly label: string;
}

export interface UnidadeOrigemOption {
  readonly value: OrigemUnidade;
  readonly label: string;
}

export const TIPOS_UNIDADE: readonly UnidadeTipoOption[] = [
  { value: 1, label: 'Reitoria' },
  { value: 2, label: 'Pró-Reitoria' },
  { value: 3, label: 'Centro' },
  { value: 4, label: 'Instituto' },
  { value: 5, label: 'Faculdade' },
  { value: 6, label: 'Departamento' },
  { value: 7, label: 'Coordenação' },
  { value: 8, label: 'Diretoria' },
  { value: 9, label: 'Divisão' },
  { value: 10, label: 'Núcleo' },
  { value: 11, label: 'Outro' },
] as const;

export const ORIGENS_UNIDADE: readonly UnidadeOrigemOption[] = [
  { value: 1, label: 'Legado COC' },
  { value: 2, label: 'Criado no Uni+' },
  { value: 3, label: 'Importado SIORG' },
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
