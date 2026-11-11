import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { AUTORIZACAO_BASE_PATH } from './tokens';

export type MotivoDaContencaoRequest = components['schemas']['MotivoDaContencaoRequest'];
export type RetomadaDaSuspensaoRequest = components['schemas']['RetomadaDaSuspensaoRequest'];
export type RetomadaDaSuspensaoDto = components['schemas']['RetomadaDaSuspensaoDto'];
export type SuspensaoDoPerfilDto = components['schemas']['SuspensaoDoPerfilDto'];
export type RegistroDaContencaoDto = components['schemas']['RegistroDaContencaoDto'];

/** Cliente da contenção do perfil: suspender, retomar, desativar, reativar e a trilha de cada ato. */
@Injectable({ providedIn: 'root' })
export class ContencaoDoPerfilApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);
  private readonly raiz = `${this.basePath}/api/autorizacao/perfis`;

  /** POST `.../perfis/{id}/suspensao` — bloqueia o acesso de todas as concessões do perfil, sem revogá-las. */
  suspender(
    id: string,
    request: MotivoDaContencaoRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.post<ApiResult<void>>(`${this.perfil(id)}/suspensao`, request, { context });
  }

  /** POST `.../perfis/{id}/suspensao/retomada` — decide uma etapa da retomada; a última etapa encerra a suspensão. */
  retomar(
    id: string,
    request: RetomadaDaSuspensaoRequest,
    context: HttpContext,
  ): Observable<ApiResult<RetomadaDaSuspensaoDto>> {
    return this.http.post<ApiResult<RetomadaDaSuspensaoDto>>(
      `${this.perfil(id)}/suspensao/retomada`,
      request,
      { context },
    );
  }

  /** POST `.../perfis/{id}/desativacao` — impede pedidos e versões novas; as concessões seguem valendo. */
  desativar(
    id: string,
    request: MotivoDaContencaoRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.post<ApiResult<void>>(`${this.perfil(id)}/desativacao`, request, { context });
  }

  /** POST `.../perfis/{id}/reativacao` — reativa o perfil, por outra pessoa da gestão de acessos. */
  reativar(
    id: string,
    request: MotivoDaContencaoRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.post<ApiResult<void>>(`${this.perfil(id)}/reativacao`, request, { context });
  }

  private perfil(id: string): string {
    return `${this.raiz}/${encodeURIComponent(id)}`;
  }
}
