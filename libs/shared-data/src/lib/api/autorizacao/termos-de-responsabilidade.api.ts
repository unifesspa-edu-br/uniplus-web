import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import { PaginaQuery, paramsDaPagina } from './paginacao';
import type { components } from './schema';
import { AUTORIZACAO_BASE_PATH } from './tokens';

/** O tipo de mídia das leituras do termo (ADR-0016). */
const RECURSO = 'versao-do-termo';

/** Uma versão publicada do termo. `resumo` é o SHA-256, em hexadecimal, do texto normalizado. */
export type VersaoDoTermoDto = components['schemas']['VersaoDoTermoDto'];
/** A versão no histórico, sem o texto. */
export type VersaoDoTermoResumoDto = components['schemas']['VersaoDoTermoResumoDto'];
/** Publica uma versão; `versaoVigenteEsperadaId` é a vigente que a tela leu, ou `null` sem termo. */
export type PublicarVersaoDoTermoRequest = components['schemas']['PublicarVersaoDoTermoRequest'];
/** Quem aceitou, quando e qual versão, com o resumo do texto apresentado. */
export type AceiteDoTermoDto = components['schemas']['AceiteDoTermoDto'];
/** A versão fixada no pedido protegido e o aceite dela, quando já houve. */
export type TermoDoPedidoDto = components['schemas']['TermoDoPedidoDto'];

/** Cliente do termo de responsabilidade: a vigente, as versões e a publicação. */
@Injectable({ providedIn: 'root' })
export class TermosDeResponsabilidadeApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);
  private readonly raiz = `${this.basePath}/api/autorizacao/termos-de-responsabilidade`;

  /** GET `.../vigente` — a versão vigente; 404 `termo.sem_versao_vigente` sem publicação. */
  vigente(): Observable<ApiResult<VersaoDoTermoDto>> {
    return this.http.get<ApiResult<VersaoDoTermoDto>>(`${this.raiz}/vigente`, {
      context: withVendorMime(RECURSO, 1),
    });
  }

  /** GET `.../versoes/{id}` — a versão fixada num pedido, com o texto. */
  versao(id: string): Observable<ApiResult<VersaoDoTermoDto>> {
    return this.http.get<ApiResult<VersaoDoTermoDto>>(
      `${this.raiz}/versoes/${encodeURIComponent(id)}`,
      { context: withVendorMime(RECURSO, 1) },
    );
  }

  /** GET `.../versoes` — o histórico, da versão 1 à mais recente, paginado por cursor. */
  historico(query: PaginaQuery = {}): Observable<ApiResult<readonly VersaoDoTermoResumoDto[]>> {
    return this.http.get<ApiResult<readonly VersaoDoTermoResumoDto[]>>(`${this.raiz}/versoes`, {
      params: paramsDaPagina(query, {}),
      context: withVendorMime(RECURSO, 1),
    });
  }

  /** POST `.../versoes` — publica a versão nova; exige `Idempotency-Key` no contexto. */
  publicar(
    request: PublicarVersaoDoTermoRequest,
    context: HttpContext,
  ): Observable<ApiResult<VersaoDoTermoDto>> {
    return this.http.post<ApiResult<VersaoDoTermoDto>>(`${this.raiz}/versoes`, request, {
      context,
    });
  }
}
