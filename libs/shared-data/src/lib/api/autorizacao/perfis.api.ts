import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import { PaginaQuery, paramsDaPagina } from './paginacao';
import type { components } from './schema';
import { AUTORIZACAO_BASE_PATH } from './tokens';

export type PerfilDto = components['schemas']['PerfilDto'];
export type PermissaoDoPerfilDto = components['schemas']['PermissaoDoPerfilDto'];
export type PermissaoDoCatalogoDto = components['schemas']['PermissaoDoCatalogoResponse'];
export type RecursoDoCatalogoDto = components['schemas']['RecursoDoCatalogoResponse'];
export type ModuloDoCatalogoDto = components['schemas']['ModuloDoCatalogoResponse'];
export type CriarPerfilCommand = components['schemas']['CriarPerfilCommand'];
export type AtualizarPerfilCommand = components['schemas']['AtualizarPerfilCommand'];

/** Cliente dos perfis de acesso e do catálogo de permissões que os compõem. */
@Injectable({ providedIn: 'root' })
export class PerfisApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);

  /** GET `/api/autorizacao/perfis` — lista paginada por cursor. */
  listar(query: PaginaQuery = {}): Observable<ApiResult<readonly PerfilDto[]>> {
    return this.http.get<ApiResult<readonly PerfilDto[]>>(
      `${this.basePath}/api/autorizacao/perfis`,
      {
        params: paramsDaPagina(query, {}),
        context: withVendorMime('perfil', 1),
      },
    );
  }

  /** GET `/api/autorizacao/permissoes` — catálogo de permissões, agrupado por módulo e recurso. */
  catalogoDePermissoes(): Observable<ApiResult<readonly ModuloDoCatalogoDto[]>> {
    return this.http.get<ApiResult<readonly ModuloDoCatalogoDto[]>>(
      `${this.basePath}/api/autorizacao/permissoes`,
      { context: withVendorMime('permissao-catalogo', 1) },
    );
  }

  /** POST `/api/autorizacao/perfis` — cria o perfil e devolve o identificador. */
  criar(command: CriarPerfilCommand, context: HttpContext): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(`${this.basePath}/api/autorizacao/perfis`, command, {
      context,
    });
  }

  /** PUT `/api/autorizacao/perfis/{id}` — substitui nome, descrição e permissões do perfil comum. */
  atualizar(
    id: string,
    command: AtualizarPerfilCommand,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/autorizacao/perfis/${encodeURIComponent(id)}`,
      command,
      { context },
    );
  }

  /** POST `/api/autorizacao/perfis/{id}/ativacao` — reativa o perfil. */
  ativar(id: string, context: HttpContext): Observable<ApiResult<void>> {
    return this.http.post<ApiResult<void>>(
      `${this.basePath}/api/autorizacao/perfis/${encodeURIComponent(id)}/ativacao`,
      null,
      { context },
    );
  }

  /** DELETE `/api/autorizacao/perfis/{id}/ativacao` — desativa o perfil sem revogar concessões. */
  desativar(id: string, context: HttpContext): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.basePath}/api/autorizacao/perfis/${encodeURIComponent(id)}/ativacao`,
      { context },
    );
  }
}
