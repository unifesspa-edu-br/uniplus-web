export type { DecisaoDaMigracao } from './codigos-de-autorizacao';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { AUTORIZACAO_BASE_PATH } from './tokens';

export type JanelaDeMigracaoDto = components['schemas']['RevisaoDasConcessoesDto'];
export type ItemDaJanelaDto = components['schemas']['ConcessaoDaRevisaoDto'];
export type ItemDaFilaDeJanelasDto = components['schemas']['ItemDaListaDeRevisoesDto'];
export type JanelaDoPerfilDto = components['schemas']['RevisaoDoPerfilDto'];
export type EnviarLoteDaMigracaoRequest = components['schemas']['EnviarDecisoesDaRevisaoRequest'];
export type DecidirRetidaRequest = components['schemas']['DecidirRetidaRequest'];
export type DecidirEtapaDaProtecaoRequest = components['schemas']['DecidirEtapaDaProtecaoRequest'];
export type EncerrarJanelaRequest = components['schemas']['EncerrarRevisaoRequest'];

/** Cliente da janela de migração do perfil: lote, retidas, proteção de dados e encerramento. */
@Injectable({ providedIn: 'root' })
export class JanelaDeMigracaoApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);

  /** POST `.../perfis/{id}/revisao-das-concessoes/decisoes` — a decisão da gestão de acessos sobre a lista inteira. */
  enviarLote(
    perfilId: string,
    request: EnviarLoteDaMigracaoRequest,
    context: HttpContext,
  ): Observable<ApiResult<JanelaDeMigracaoDto>> {
    return this.post(`${this.janela(perfilId)}/decisoes`, request, context);
  }

  /** POST `.../revisao-das-concessoes/retidas/{concessaoId}` — a concessão que o lote reteve, decidida por outra pessoa. */
  decidirRetida(
    perfilId: string,
    concessaoId: string,
    request: DecidirRetidaRequest,
    context: HttpContext,
  ): Observable<ApiResult<JanelaDeMigracaoDto>> {
    return this.post(
      `${this.janela(perfilId)}/retidas/${encodeURIComponent(concessaoId)}`,
      request,
      context,
    );
  }

  /** POST `.../revisao-das-concessoes/protecao-de-dados` — a etapa da proteção de dados, de uma concessão a várias. */
  decidirProtecaoDeDados(
    perfilId: string,
    request: DecidirEtapaDaProtecaoRequest,
    context: HttpContext,
  ): Observable<ApiResult<JanelaDeMigracaoDto>> {
    return this.post(`${this.janela(perfilId)}/protecao-de-dados`, request, context);
  }

  /** POST `.../revisao-das-concessoes/encerramento` — encerra a versão anterior antes do prazo, com motivo. */
  encerrar(
    perfilId: string,
    request: EncerrarJanelaRequest,
    context: HttpContext,
  ): Observable<ApiResult<JanelaDeMigracaoDto>> {
    return this.post(`${this.janela(perfilId)}/encerramento`, request, context);
  }

  private post(
    url: string,
    corpo: unknown,
    context: HttpContext,
  ): Observable<ApiResult<JanelaDeMigracaoDto>> {
    return this.http.post<ApiResult<JanelaDeMigracaoDto>>(url, corpo, { context });
  }

  private janela(perfilId: string): string {
    return `${this.basePath}/api/autorizacao/perfis/${encodeURIComponent(perfilId)}/revisao-das-concessoes`;
  }
}
