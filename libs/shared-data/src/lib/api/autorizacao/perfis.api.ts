import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { AUTORIZACAO_BASE_PATH } from './tokens';

export type PerfilDto = components['schemas']['PerfilDto'];
export type PerfilListadoDto = components['schemas']['PerfilListadoDto'];
export type PermissaoDoPerfilDto = components['schemas']['PermissaoDoPerfilDto'];
export type ComposicaoEmVigorDto = components['schemas']['ComposicaoEmVigorDto'];
export type UltimaVersaoEncerradaSemVigorDto =
  components['schemas']['UltimaVersaoEncerradaSemVigorDto'];
export type PermissaoDoCatalogoDto = components['schemas']['PermissaoDoCatalogoResponse'];
export type ResourceDoCatalogoDto = components['schemas']['ResourceDoCatalogoResponse'];
export type ModuloDoCatalogoDto = components['schemas']['ModuloDoCatalogoResponse'];
export type DadosDaVersaoRequest = components['schemas']['DadosDaVersaoRequest'];
export type RemoverPermissoesRequest = components['schemas']['RemoverPermissoesRequest'];

/** Motivos de contenção que a API aceita na remoção de permissões. */
export type CategoriaDaRemocao = 'incidente' | 'erro_de_composicao' | 'mudanca_de_funcao';

/** Cliente dos perfis de acesso: leitura, criação, remoção de permissões e situação. */
@Injectable({ providedIn: 'root' })
export class PerfisApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);
  private readonly raiz = `${this.basePath}/api/autorizacao/perfis`;

  /** GET `/api/autorizacao/perfis/{id}` — o perfil com a versão em vigor e a pendente. */
  obter(id: string): Observable<ApiResult<PerfilDto>> {
    return this.http.get<ApiResult<PerfilDto>>(`${this.raiz}/${encodeURIComponent(id)}`, {
      context: withVendorMime('perfil', 1),
    });
  }

  /** POST `/api/autorizacao/perfis` — cria o perfil com a primeira versão pendente e devolve a URL de envio do documento. */
  criar(
    request: DadosDaVersaoRequest,
    context: HttpContext,
  ): Observable<ApiResult<components['schemas']['EnvioDoDocumentoDto']>> {
    return this.http.post<ApiResult<components['schemas']['EnvioDoDocumentoDto']>>(
      this.raiz,
      request,
      { context },
    );
  }

  /** POST `/api/autorizacao/perfis/{id}/remocoes` — retira permissões da versão em vigor, com efeito imediato. */
  remover(
    id: string,
    request: RemoverPermissoesRequest,
    context: HttpContext,
  ): Observable<ApiResult<PerfilDto>> {
    return this.http.post<ApiResult<PerfilDto>>(
      `${this.raiz}/${encodeURIComponent(id)}/remocoes`,
      request,
      { context },
    );
  }

  /** POST `/api/autorizacao/perfis/{id}/ativacao` — reativa o perfil. */
  ativar(id: string, context: HttpContext): Observable<ApiResult<void>> {
    return this.http.post<ApiResult<void>>(
      `${this.raiz}/${encodeURIComponent(id)}/ativacao`,
      null,
      { context },
    );
  }

  /** DELETE `/api/autorizacao/perfis/{id}/ativacao` — desativa o perfil sem revogar concessões. */
  desativar(id: string, context: HttpContext): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.raiz}/${encodeURIComponent(id)}/ativacao`,
      { context },
    );
  }
}
