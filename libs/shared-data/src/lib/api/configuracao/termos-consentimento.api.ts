import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type TermoConsentimentoDto =
  components['schemas']['TermoConsentimentoDto'];
export type TermoConsentimentoResumoDto =
  components['schemas']['TermoConsentimentoResumoDto'];
export type TermoConsentimentoVersaoDto = components['schemas']['TermoConsentimentoVersaoDto'];
export type CriarTermoConsentimentoCommand =
  components['schemas']['CriarTermoConsentimentoCommand'];
export type EditarRascunhoTermoConsentimentoCommand =
  components['schemas']['EditarRascunhoTermoConsentimentoCommand'];

/** Filtro de listagem (cursor pagination, ADR-0026). */
export interface FormaAceiteOption {
  readonly value: string;
  readonly label: string;
}

export const FORMAS_ACEITE: readonly FormaAceiteOption[] = [
  { value: 'A_DEFINIR', label: 'A definir' },
  { value: 'REGISTRO_DIGITAL_SEM_LOG_IP', label: 'Registro digital (sem log de IP)' },
  { value: 'REGISTRO_DIGITAL_COM_LOG_IP', label: 'Registro digital (com log de IP)' },
] as const;

export interface TermosConsentimentoQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
  readonly q?: string;
}
/**
 * Cliente Angular standalone do recurso Termo de Consentimento
 * (módulo Configuração).
 *
 * O cadastro possui um ciclo de vida composto por elaboração do rascunho,
 * revisão e promoção de uma versão imutável.
 *
 * API thin (ADR-0013): tipos do `schema.ts`; resposta envelopada em
 * `ApiResult<T>` (ADR-0011); vendor MIME `termo-consentimento v1`
 * (ADR-0016/0028).
 *
 * A listagem retorna o resumo dos termos, enquanto o detalhe retorna
 * o termo completo, incluindo as versões promovidas.
 *
 * As operações administrativas que alteram o recurso recebem
 * `HttpContext` para transporte da `Idempotency-Key`, conforme
 * ADR-0014.
 *
 * O ator de revisão ou promoção é resolvido e registrado internamente
 * pelo backend e não é exposto nos DTOs deste cliente.
 */

@Injectable({
  providedIn: 'root',
})
export class TermosConsentimentoApi {
  private readonly http = inject(HttpClient);

  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** GET `/api/configuracao/termos-consentimento` — lista os termos por cursor. */
  listar(
    query: TermosConsentimentoQuery = {},
  ): Observable<ApiResult<readonly TermoConsentimentoResumoDto[]>> {
    let params = new HttpParams();

    const q = query.q?.trim();

    if (q) {
      params = params.set('q', q);
    }

    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
    } else {
      params = params.set('limit', String(query.limit ?? 100));
    }

    return this.http.get<ApiResult<readonly TermoConsentimentoResumoDto[]>>(
      `${this.basePath}/api/configuracao/termos-consentimento`,
      {
        params,
        context: withVendorMime('termo-consentimento', 1),
      },
    );
  }

  /** GET `/api/configuracao/termos-consentimento/{id}` — detalhe completo, incluindo versões promovidas. */
  obter(id: string): Observable<ApiResult<TermoConsentimentoDto>> {
    return this.http.get<ApiResult<TermoConsentimentoDto>>(
      `${this.basePath}/api/configuracao/termos-consentimento/${encodeURIComponent(id)}`,
      {
        context: withVendorMime('termo-consentimento', 1),
      },
    );
  }

  /** POST `/api/configuracao/admin/termos-consentimento` — cria um termo. Idempotency-Key (ADR-0014). */
  criar(
    command: CriarTermoConsentimentoCommand,
    context: HttpContext,
  ): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(
      `${this.basePath}/api/configuracao/admin/termos-consentimento`,
      command,
      {
        context,
        headers: new HttpHeaders({
          Accept: 'application/json',
        }),
      },
    );
  }

  /** PUT `/api/configuracao/admin/termos-consentimento/{id}/rascunho` — edita o rascunho. Idempotency-Key (ADR-0014). */
  editarRascunho(
    id: string,
    command: EditarRascunhoTermoConsentimentoCommand,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/termos-consentimento/${encodeURIComponent(id)}/rascunho`,
      command,
      {
        context,
      },
    );
  }

  /** POST `/api/configuracao/admin/termos-consentimento/{id}/revisar` — marca o rascunho como revisado. Idempotency-Key (ADR-0014). */
  revisar(id: string, context: HttpContext): Observable<ApiResult<void>> {
    return this.http.post<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/termos-consentimento/${encodeURIComponent(id)}/revisar`,
      {},
      {
        context,
      },
    );
  }

  /** POST `/api/configuracao/admin/termos-consentimento/{id}/promover` — promove o rascunho revisado para uma nova versão. Idempotency-Key (ADR-0014). */
  promover(id: string, context: HttpContext): Observable<ApiResult<void>> {
    return this.http.post<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/termos-consentimento/${encodeURIComponent(id)}/promover`,
      {},
      {
        context,
      },
    );
  }

  /** DELETE `/api/configuracao/admin/termos-consentimento/{id}` — remove o termo quando não há versão promovida. */
  remover(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/termos-consentimento/${encodeURIComponent(id)}`,
    );
  }
}

