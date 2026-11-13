import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { SELECAO_BASE_PATH } from './tokens';

export type MotivoDeDecisaoDto = components['schemas']['MotivoDeDecisaoDto'];
export type CriarMotivoDeDecisaoCommand = components['schemas']['CriarMotivoDeDecisaoCommand'];
export type AtualizarMotivoDeDecisaoCommand =
  components['schemas']['AtualizarMotivoDeDecisaoCommand'];

/** Filtro da listagem do cadastro de motivos (cursor pagination, ADR-0026). */
export interface MotivosDeDecisaoQuery {
  readonly tipo?: string;
  readonly apenasAtivos?: boolean;
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

/**
 * Cliente Angular standalone do cadastro único de motivos de decisão (módulo Seleção,
 * UNI-REQ-0283): um cadastro só, organizado por tipo. A leitura é pública sob
 * `/api/selecao/motivos-de-decisao`; a manutenção, sob `/api/selecao/admin/motivos-de-decisao`,
 * exige a permissão `selecao:motivos-de-decisao:manter` e `Idempotency-Key`.
 *
 * Só a descrição é editável: tipo, código, subclassificação e sentido não mudam depois da criação.
 *
 * API thin (ADR-0013): tipos do `schema.ts` gerado; resposta envelopada em `ApiResult<T>`
 * (ADR-0011); versionamento por vendor MIME `motivo-de-decisao v1` (ADR-0016).
 */
@Injectable({ providedIn: 'root' })
export class MotivosDeDecisaoApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(SELECAO_BASE_PATH);

  /** GET `/api/selecao/motivos-de-decisao` — por padrão só os ativos; `apenasAtivos: false` inclui os desativados. */
  listar(query: MotivosDeDecisaoQuery = {}): Observable<ApiResult<readonly MotivoDeDecisaoDto[]>> {
    return this.http.get<ApiResult<readonly MotivoDeDecisaoDto[]>>(
      `${this.basePath}/api/selecao/motivos-de-decisao`,
      { params: paramsDaListagem(query), context: withVendorMime('motivo-de-decisao', 1) },
    );
  }

  /** POST `/api/selecao/admin/motivos-de-decisao` — cria. Idempotency-Key obrigatório. */
  criar(command: CriarMotivoDeDecisaoCommand, context: HttpContext): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(
      `${this.basePath}/api/selecao/admin/motivos-de-decisao`,
      command,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /** PUT `/api/selecao/admin/motivos-de-decisao/{id}` — edita a descrição. */
  atualizar(
    id: string,
    command: AtualizarMotivoDeDecisaoCommand,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/selecao/admin/motivos-de-decisao/${encodeURIComponent(id)}`,
      command,
      { context },
    );
  }

  /** DELETE `/api/selecao/admin/motivos-de-decisao/{id}/ativacao` — desativa (efeito prospectivo). */
  desativar(id: string, context: HttpContext): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(this.rotaDaAtivacao(id), { context });
  }

  /** POST `/api/selecao/admin/motivos-de-decisao/{id}/ativacao` — reativa. */
  reativar(id: string, context: HttpContext): Observable<ApiResult<void>> {
    return this.http.post<ApiResult<void>>(this.rotaDaAtivacao(id), null, { context });
  }

  private rotaDaAtivacao(id: string): string {
    return `${this.basePath}/api/selecao/admin/motivos-de-decisao/${encodeURIComponent(id)}/ativacao`;
  }
}

function paramsDaListagem(query: MotivosDeDecisaoQuery): HttpParams {
  let params = new HttpParams();
  if (query.tipo !== undefined) params = params.set('tipo', query.tipo);
  if (query.apenasAtivos !== undefined) {
    params = params.set('apenasAtivos', String(query.apenasAtivos));
  }
  if (query.cursor !== undefined && query.cursor.length > 0) {
    return params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
  }
  return params.set('limit', String(query.limit ?? 100));
}
