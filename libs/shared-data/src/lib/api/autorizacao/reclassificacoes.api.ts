import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { AUTORIZACAO_BASE_PATH } from './tokens';

export type ItemDaFilaDeReclassificacoesDto = components['schemas']['ItemDaFilaDeReclassificacoesDto'];
export type ReclassificacaoDto = components['schemas']['ReclassificacaoDto'];
export type MudancaDaPermissaoDto = components['schemas']['MudancaDaPermissaoDto'];
export type VersaoEmUsoDto = components['schemas']['VersaoEmUsoDto'];
export type PermissaoDaVersaoEmUsoDto = components['schemas']['PermissaoDaVersaoEmUsoDto'];
export type ConcessaoSuspensaDto = components['schemas']['ConcessaoSuspensaDto'];
export type DecidirReclassificacaoRequest = components['schemas']['DecidirReclassificacaoRequest'];
export type DecisaoDaReclassificacaoDto = components['schemas']['DecisaoDaReclassificacaoDto'];
export type DivergenciaDaGovernancaDto = components['schemas']['DivergenciaDaGovernancaDto'];

/** O resultado da decisão de uma etapa sobre as concessões suspensas pela reclassificação. */
export type ResultadoDaReclassificacao = 'liberada' | 'mantida';

/** Cliente da reclassificação de permissão: a decisão de cada etapa sobre as concessões suspensas. */
@Injectable({ providedIn: 'root' })
export class ReclassificacoesApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);

  /** POST `.../reclassificacoes/{id}/decisoes` — decide a etapa de forma atômica para as concessões. */
  decidir(
    id: string,
    request: DecidirReclassificacaoRequest,
    context: HttpContext,
  ): Observable<ApiResult<DecisaoDaReclassificacaoDto>> {
    return this.http.post<ApiResult<DecisaoDaReclassificacaoDto>>(
      `${this.basePath}/api/autorizacao/reclassificacoes/${encodeURIComponent(id)}/decisoes`,
      request,
      { context },
    );
  }
}
