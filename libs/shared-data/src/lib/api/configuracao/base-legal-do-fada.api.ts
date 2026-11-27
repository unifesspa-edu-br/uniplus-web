import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime, janelaDaPagina } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type BaseLegalDoFadaDto = components['schemas']['BaseLegalDoFadaDto'];
export type MunicipioDaBaseLegalDoFadaDto = components['schemas']['MunicipioDaBaseLegalDoFadaDto'];
export type CriarBaseLegalDoFadaCommand = components['schemas']['CriarBaseLegalDoFadaCommand'];
export type CriarBaseLegalDoFadaMunicipioCommand =
  components['schemas']['CriarMunicipioDaBaseLegalDoFadaCommand'];
export type AtualizarBaseLegalDoFadaCommand =
  components['schemas']['AtualizarBaseLegalDoFadaCommand'];

/** Filtro de listagem de Base Legal do Fator de Atenuação das Desigualdades de Acesso (cursor pagination, ADR-0026). */
export interface BaseLegalDoFadaQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

/**
 * Cliente Angular standalone do cadastro de Base Legal do Fator de Atenuação das Desigualdades de Acesso
 * (módulo Configuração): o documento formal (Lei/Decreto/Portaria/Resolução/
 * Instrução Normativa/Parecer) e os municípios que ele beneficia. O passo do Fator de Atenuação do Processo Seletivo congela uma cópia deste cadastro no momento
 * da configuração — editar ou desativar aqui não altera processos já
 * configurados.
 *
 * API thin (ADR-0013): tipos do `schema.ts` gerado; resposta envelopada em
 * `ApiResult<T>` (ADR-0011); versionamento por vendor MIME
 * `base-legal-do-fada v1` (ADR-0016/0028). Espelha `TiposDocumentoApi`.
 */
@Injectable({ providedIn: 'root' })
export class BaseLegalDoFadaApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** GET `/api/configuracao/bases-legais-fada` — lista paginada por cursor (ADR-0026). */
  listar(query: BaseLegalDoFadaQuery = {}): Observable<ApiResult<readonly BaseLegalDoFadaDto[]>> {
    return this.http.get<ApiResult<readonly BaseLegalDoFadaDto[]>>(
      `${this.basePath}/api/configuracao/bases-legais-fada`,
      {
        params: janelaDaPagina(new HttpParams(), query),
        context: withVendorMime('base-legal-do-fada', 1),
      },
    );
  }

  /** GET `/api/configuracao/bases-legais-fada/{id}` — detalhe de uma Base Legal. */
  obter(id: string): Observable<ApiResult<BaseLegalDoFadaDto>> {
    return this.http.get<ApiResult<BaseLegalDoFadaDto>>(
      `${this.basePath}/api/configuracao/bases-legais-fada/${encodeURIComponent(id)}`,
      { context: withVendorMime('base-legal-do-fada', 1) },
    );
  }

  /** POST `/api/configuracao/admin/bases-legais-fada` — cria uma Base Legal. Idempotency-Key obrigatório (ADR-0027). */
  criar(command: CriarBaseLegalDoFadaCommand, context: HttpContext): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(
      `${this.basePath}/api/configuracao/admin/bases-legais-fada`,
      command,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /** PUT `/api/configuracao/admin/bases-legais-fada/{id}` — atualiza uma Base Legal. */
  atualizar(
    id: string,
    command: AtualizarBaseLegalDoFadaCommand,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/bases-legais-fada/${encodeURIComponent(id)}`,
      command,
      { context },
    );
  }

  /** DELETE `/api/configuracao/admin/bases-legais-fada/{id}` — remoção (soft-delete). */
  remover(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/bases-legais-fada/${encodeURIComponent(id)}`,
    );
  }
}
