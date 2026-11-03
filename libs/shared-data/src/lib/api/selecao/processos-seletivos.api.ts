import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type {
  CriarProcessoSeletivoCommand,
  DefinirIdentificadorLegivelRequest,
  DefinirOfertaAtendimentoRequest,
  DefinirTaxaInscricaoRequest,
  FundamentoIsencaoDto,
  ProcessoSeletivoDto,
  ProcessoSeletivoResumoDto,
} from './processos-seletivos.contrato';
import { rotasDoProcesso } from './rotas-do-processo';
import { SELECAO_BASE_PATH } from './tokens';

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
  private readonly rotas = rotasDoProcesso(inject(SELECAO_BASE_PATH));

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

    return this.http.get<ApiResult<readonly ProcessoSeletivoResumoDto[]>>(this.rotas.colecao(), {
      params,
      context: withVendorMime('processo-seletivo', 1),
    });
  }

  /**
   * PUT `/api/selecao/processos-seletivos/{id}/identificador-legivel` — declara o
   * endereço público do certame.
   *
   * Recusa com 409 (`identificador_legivel_em_uso`) o valor já usado por outro
   * processo, e com 422 o que o formato ou a imutabilidade depois de publicado
   * não admitem — as recusas do campo compartilham o prefixo
   * `uniplus.selecao.processo_seletivo.identificador_legivel_`.
   *
   * Responde 204 sem corpo.
   */
  definirIdentificadorLegivel(
    processoSeletivoId: string,
    request: DefinirIdentificadorLegivelRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      this.rotas.doProcesso(processoSeletivoId, 'identificador-legivel'),
      request,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /**
   * PUT `/api/selecao/processos-seletivos/{id}/oferta-atendimento` — declara o
   * atendimento especializado do processo por **id** dos cadastros de
   * Configuração: condições de atendimento, recursos de acessibilidade e
   * tipos de deficiência.
   *
   * O agregado recusa com 422 (`OfertaAtendimento.TipoDeficienciaSemCondicaoPcd`)
   * qualquer `tipoDeficienciaIds` não vazio sem a condição de código `PCD`
   * marcada em `condicaoIds` — quem chama não filtra isso no cliente, é o
   * servidor que arbitra a invariante.
   *
   * Responde 204 sem corpo.
   */
  definirOfertaAtendimento(
    processoSeletivoId: string,
    request: DefinirOfertaAtendimentoRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      this.rotas.doProcesso(processoSeletivoId, 'oferta-atendimento'),
      request,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /** GET `/api/selecao/processos-seletivos/{id}` — detalhe e snapshot do tipo. */
  obter(id: string): Observable<ApiResult<ProcessoSeletivoDto>> {
    return this.http.get<ApiResult<ProcessoSeletivoDto>>(this.rotas.doProcesso(id), {
      context: withVendorMime('processo-seletivo', 1),
    });
  }

  /** POST `/api/selecao/processos-seletivos` — criação idempotente. */
  criar(
    command: CriarProcessoSeletivoCommand,
    context: HttpContext,
  ): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(this.rotas.colecao(), command, {
      context,
      headers: new HttpHeaders({ Accept: 'application/json' }),
    });
  }

  /**
   * GET `/api/selecao/fundamentos-isencao` — vocabulário fechado dos fundamentos
   * que a configuração pode referenciar, com nome e descrição para exibição.
   *
   * A lista vem da API e não é escrita aqui de propósito: o vocabulário é do
   * domínio, e uma cópia no cliente ficaria defasada em silêncio a cada
   * fundamento acrescentado.
   */
  listarFundamentosIsencao(): Observable<ApiResult<readonly FundamentoIsencaoDto[]>> {
    return this.http.get<ApiResult<readonly FundamentoIsencaoDto[]>>(
      this.rotas.doCatalogo('fundamentos-isencao'),
      { context: withVendorMime('fundamento-isencao', 1) },
    );
  }

  /**
   * PUT `/api/selecao/processos-seletivos/{id}/taxa-inscricao` — declara se o
   * processo cobra taxa, quanto, e quais fundamentos de isenção reconhece.
   *
   * O `If-Match` não vai aqui: em rascunho não há sessão editorial nem ETag, e
   * o servidor ignora a precondição. Retificar processo publicado é outro
   * fluxo, e exigirá o cabeçalho quando existir.
   *
   * Responde 204 sem corpo.
   */
  definirTaxaInscricao(
    processoSeletivoId: string,
    request: DefinirTaxaInscricaoRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      this.rotas.doProcesso(processoSeletivoId, 'taxa-inscricao'),
      request,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }
}
