import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ApiResult, withVendorMime, extractNextCursor } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { SELECAO_BASE_PATH } from './tokens';
import { expand, reduce } from 'rxjs/operators';

export type CriarProcessoSeletivoCommand = components['schemas']['CriarProcessoSeletivoCommand'];
export type ProcessoSeletivoDto = components['schemas']['ProcessoSeletivoDto'];
export type ProcessoSeletivoResumoDto = components['schemas']['ProcessoSeletivoResumoDto'];
export type TipoProcessoSnapshotDto = components['schemas']['TipoProcessoSnapshotDto'];
export type IniciarUploadDocumentoEditalDto =
  components['schemas']['IniciarUploadDocumentoEditalDto'];
export type DocumentoEditalDto = components['schemas']['DocumentoEditalDto'];

/* DTOs dos sub-recursos mapeados do schema OpenAPI */
export type EtapaProcessoInput = components['schemas']['EtapaProcessoInput'];
export type DefinirOfertaAtendimentoRequest =
  components['schemas']['DefinirOfertaAtendimentoRequest'];
export type ConfiguracaoDistribuicaoVagasInput =
  components['schemas']['ConfiguracaoDistribuicaoVagasInput'];
export type CriterioDesempateInput = components['schemas']['CriterioDesempateInput'];
export type DefinirBonusRegionalRequest = components['schemas']['DefinirBonusRegionalRequest'];

/** Filtro da listagem de Processos Seletivos (cursor opaco, ADR-0026). */
export interface ProcessosSeletivosQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

/**
 * Cliente do agregado raiz Processo Seletivo.
 *
 * Criação referencia um tipo ativo por UUID. Consultas leem o snapshot
 * `tipoProcesso` retornado por Seleção, que não deve ser substituído por uma
 * nova consulta ao catálogo vivo (ADR-0122 da API).
 */
@Injectable({ providedIn: 'root' })
export class ProcessosSeletivosApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(SELECAO_BASE_PATH);

  /** GET `/api/selecao/processos-seletivos` — lista paginada por cursor opaco. */
  listar(
    query: ProcessosSeletivosQuery = {},
  ): Observable<ApiResult<readonly ProcessoSeletivoResumoDto[]>> {
    let params = new HttpParams();
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
    } else {
      params = params.set('limit', String(query.limit ?? 100));
    }

    return this.http.get<ApiResult<readonly ProcessoSeletivoResumoDto[]>>(
      `${this.basePath}/api/selecao/processos-seletivos`,
      { params, context: withVendorMime('processo-seletivo', 1) },
    );
  }

  /** GET `/api/selecao/processos-seletivos` — lista todos os processos seletivos percorrendo a paginação por cursor. */
  listarTodos(): Observable<ApiResult<readonly ProcessoSeletivoResumoDto[]>> {
    return this.listar({ limit: 100 }).pipe(
      expand((resultado) => {
        if (!resultado.ok) {
          return of();
        }

        const link = resultado.headers?.get('Link') ?? null;
        const next = extractNextCursor(link);

        if (next === null) {
          return of();
        }

        return this.listar({
          cursor: next,
          direction: 'next',
          limit: 100,
        });
      }),
      reduce<
        ApiResult<readonly ProcessoSeletivoResumoDto[]>,
        ApiResult<readonly ProcessoSeletivoResumoDto[]>
      >((acumulado, resultado) => {
        if (!resultado.ok) {
          return resultado;
        }

        if (!acumulado.ok) {
          return acumulado;
        }

        return {
          ...resultado,
          data: [...acumulado.data, ...resultado.data],
        };
      }),
    );
  }

  /** GET `/api/selecao/processos-seletivos/{id}` — detalhe e snapshot do tipo. */
  obter(id: string): Observable<ApiResult<ProcessoSeletivoDto>> {
    return this.http.get<ApiResult<ProcessoSeletivoDto>>(
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(id)}`,
      { context: withVendorMime('processo-seletivo', 1) },
    );
  }

  /** POST `/api/selecao/processos-seletivos` — criação idempotente. */
  criar(
    command: CriarProcessoSeletivoCommand,
    context: HttpContext,
  ): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(
      `${this.basePath}/api/selecao/processos-seletivos`,
      command,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /** PUT `/api/selecao/processos-seletivos/{id}/etapas` */
  salvarEtapas(
    id: string,
    payload: readonly EtapaProcessoInput[],
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(id)}/etapas`,
      payload,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /** PUT `/api/selecao/processos-seletivos/{id}/oferta-atendimento` */
  salvarOfertaAtendimento(
    id: string,
    payload: DefinirOfertaAtendimentoRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(id)}/oferta-atendimento`,
      payload,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /** PUT `/api/selecao/processos-seletivos/{id}/distribuicao-vagas` */
  salvarDistribuicaoVagas(
    id: string,
    payload: readonly ConfiguracaoDistribuicaoVagasInput[],
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(id)}/distribuicao-vagas`,
      payload,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /** PUT `/api/selecao/processos-seletivos/{id}/criterios-desempate` */
  salvarCriteriosDesempate(
    id: string,
    payload: readonly CriterioDesempateInput[],
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(id)}/criterios-desempate`,
      payload,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /** PUT `/api/selecao/processos-seletivos/{id}/bonus-regional` */
  salvarBonusRegional(
    id: string,
    payload: DefinirBonusRegionalRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(id)}/bonus-regional`,
      payload,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  // =========================================================================
  // DOCUMENTOS EDITAL
  // =========================================================================

  /** POST `/api/selecao/processos-seletivos/{id}/documentos-edital` */
  iniciarUploadDocumentoEdital(
    processoSeletivoId: string,
    context: HttpContext,
  ): Observable<ApiResult<IniciarUploadDocumentoEditalDto>> {
    return this.http.post<ApiResult<IniciarUploadDocumentoEditalDto>>(
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/documentos-edital`,
      null,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /** POST `/api/selecao/processos-seletivos/{id}/documentos-edital/{docId}/confirmacao` */
  confirmarUploadDocumentoEdital(
    processoSeletivoId: string,
    documentoEditalId: string,
    context: HttpContext,
  ): Observable<ApiResult<DocumentoEditalDto>> {
    return this.http.post<ApiResult<DocumentoEditalDto>>(
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/documentos-edital/${encodeURIComponent(documentoEditalId)}/confirmacao`,
      null,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }
}
