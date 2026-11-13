import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import { PaginaQuery, paramsDaPagina } from './paginacao';
import type { components } from './schema';
import { AUTORIZACAO_BASE_PATH } from './tokens';

/*
 * TODO(uniplus-api#2365): os tipos do termo de responsabilidade seguem o contrato combinado com a
 * API e ainda não vêm do codegen. Depois do merge, `npm run generate:api` traz os equivalentes em
 * `schema.ts`, e este bloco passa a apontar para `components['schemas']`.
 */

/**
 * O tipo de mídia das leituras do termo (ADR-0016). O contrato da uniplus-api#2365 não o nomeia; segue
 * a convenção dos recursos de autorização, pelo nome do recurso no singular.
 */
const RECURSO = 'versao-do-termo';

/** Uma versão publicada do termo. `resumo` é o SHA-256, em hexadecimal, do texto normalizado. */
export interface VersaoDoTermoDto {
  readonly id: string;
  readonly numero: number;
  readonly texto: string;
  readonly resumo: string;
  readonly ato: string;
  readonly publicadaEm: string;
  readonly vigente: boolean;
}

/** A versão no histórico, sem o texto. */
export type VersaoDoTermoResumoDto = Omit<VersaoDoTermoDto, 'texto'>;

/** Publica uma versão; `versaoVigenteEsperadaId` é a vigente que a tela leu, ou `null` sem termo. */
export interface PublicarVersaoDoTermoRequest {
  readonly texto: string;
  readonly ato: string;
  readonly versaoVigenteEsperadaId: string | null;
}

/** Quem aceitou, quando e qual versão, com o resumo do texto apresentado. */
export interface AceiteDoTermoDto {
  readonly pessoa: components['schemas']['IdentidadeDto'];
  readonly aceitoEm: string;
  readonly versaoId: string;
  readonly numero: number;
  readonly resumo: string;
}

/** A versão fixada no pedido protegido e o aceite dela, quando já houve. */
export interface TermoDoPedidoDto {
  readonly versaoId: string;
  readonly numero: number;
  readonly resumo: string;
  readonly aceite: AceiteDoTermoDto | null;
}

/**
 * O que a criação do pedido declara sobre o documento e o termo apresentado. A versão vigente é
 * obrigatória no pedido de perfil protegido e não vai no dos demais (UNI-REQ-0377).
 */
export interface ApresentacaoDoTermoNaCriacao {
  readonly anexaraDocumento: boolean;
  readonly termoVersaoApresentadaId?: string;
}

/** O que o pedido lido traz sobre o documento declarado e o termo. */
export interface TermoNoPedido {
  readonly anexaraDocumento: boolean;
  readonly termo: TermoDoPedidoDto | null;
}

/** O resumo do pedido diz se ele aguarda o aceite do termo pelo beneficiário. */
export interface AceiteDoTermoPendente {
  readonly aguardaAceiteDoTermo: boolean;
}

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
