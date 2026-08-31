import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type FaseCanonicaDto = components['schemas']['FaseCanonicaDto'];
export type CriarFaseCanonicaCommand = components['schemas']['CriarFaseCanonicaCommand'];
export type AtualizarFaseCanonicaCommand = components['schemas']['AtualizarFaseCanonicaCommand'];

/** Filtro de listagem de Fases canônicas (cursor pagination, ADR-0026). */
export interface FasesCanonicasQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

/**
 * Código canônico das fases fixas do ciclo de vida do processo seletivo
 * (UNI-REQ-0064). Roster fechado — usado só pelo `select` de criação; a
 * edição trata `codigo` como imutável (readonly). Espelha
 * `FaseCanonicaCatalogo.Codigos` do backend, que não declara o enum no
 * OpenAPI: `codigo` é string no contrato e a pertença é guarda de domínio.
 */
export const CODIGOS_FASE_CANONICA = [
  'INSCRICAO',
  'SOLICITACAO_ISENCAO',
  'HOMOLOGACAO',
  'ENSALAMENTO',
  'AVALIACAO',
  'CLASSIFICACAO',
  'RESULTADO_PRELIMINAR',
  'RECURSOS',
  'RESULTADO_FINAL',
  'HABILITACAO',
  'HETEROIDENTIFICACAO',
  'MATRICULA',
  'HOMOLOGACAO_RESULTADO_FINAL',
  'LISTA_ESPERA',
  'CHAMADA',
] as const;

export type CodigoFaseCanonica = (typeof CODIGOS_FASE_CANONICA)[number];

/** Rótulo orientativo do dono típico — não vinculante (UNI-REQ-0064). */
export const DONOS_TIPICOS_FASE = ['CEPS', 'CRCA', 'MEC', 'CONSEPE'] as const;

/**
 * Origem da data da fase (UNI-REQ-0064). Domínio fechado de dois tokens, com
 * allowlist textual no backend e CHECK em `fase_canonica.origem_data`:
 * `PROPRIA` é data definida pela própria instituição; `DELEGADA` é data
 * definida por terceiro (ex.: cronograma SiSU/MEC).
 */
export const ORIGENS_DATA_FASE = ['PROPRIA', 'DELEGADA'] as const;

export type OrigemDataFase = (typeof ORIGENS_DATA_FASE)[number];

/**
 * Cliente Angular standalone do recurso Fase canônica (módulo Configuração).
 * Vocabulário fechado de cronograma — código imutável após a criação
 * (`Atualizar*Command` não aceita `codigo`).
 *
 * API thin (ADR-0013): tipos do `schema.ts` gerado; resposta envelopada em
 * `ApiResult<T>` (ADR-0011); versionamento por vendor MIME `fase-canonica v1`
 * (ADR-0016). Espelha `CampiApi`/`CursosApi`.
 */
@Injectable({ providedIn: 'root' })
export class FasesCanonicasApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** GET `/api/configuracao/fases-canonicas` — lista paginada por cursor (ADR-0026). */
  listar(query: FasesCanonicasQuery = {}): Observable<ApiResult<readonly FaseCanonicaDto[]>> {
    let params = new HttpParams();
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
    } else {
      params = params.set('limit', String(query.limit ?? 100));
    }
    return this.http.get<ApiResult<readonly FaseCanonicaDto[]>>(
      `${this.basePath}/api/configuracao/fases-canonicas`,
      { params, context: withVendorMime('fase-canonica', 1) },
    );
  }

  /** GET `/api/configuracao/fases-canonicas/{id}` — detalhe de uma Fase canônica. */
  obter(id: string): Observable<ApiResult<FaseCanonicaDto>> {
    return this.http.get<ApiResult<FaseCanonicaDto>>(
      `${this.basePath}/api/configuracao/fases-canonicas/${encodeURIComponent(id)}`,
      { context: withVendorMime('fase-canonica', 1) },
    );
  }

  /** POST `/api/configuracao/admin/fases-canonicas` — cria. Idempotency-Key obrigatório. */
  criar(command: CriarFaseCanonicaCommand, context: HttpContext): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(
      `${this.basePath}/api/configuracao/admin/fases-canonicas`,
      command,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /** PUT `/api/configuracao/admin/fases-canonicas/{id}` — atualiza (sem `codigo`, imutável). */
  atualizar(
    id: string,
    command: AtualizarFaseCanonicaCommand,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/fases-canonicas/${encodeURIComponent(id)}`,
      command,
      { context },
    );
  }

  /** DELETE `/api/configuracao/admin/fases-canonicas/{id}` — remoção lógica (soft-delete). */
  remover(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/fases-canonicas/${encodeURIComponent(id)}`,
    );
  }
}
