import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type {
  ConformidadeLegalProcessoSeletivoDto,
  ConformidadeProcessoSeletivoDto,
  PublicarProcessoSeletivoRequest,
  SnapshotVigenteDto,
} from './processos-seletivos.contrato';
import { rotasDoProcesso } from './rotas-do-processo';
import { SELECAO_BASE_PATH } from './tokens';

/** Cliente da conformidade, da publicação, do ato vigente. */
@Injectable({ providedIn: 'root' })
export class PublicacaoDoProcessoApi {
  private readonly http = inject(HttpClient);
  private readonly rotas = rotasDoProcesso(inject(SELECAO_BASE_PATH));

  /**
   * GET `/api/selecao/processos-seletivos/{id}/conformidade` — o preflight
   * **estrutural**: os seis gates que `ProcessoSeletivo.AvaliarConformidade()`
   * projeta, agrupados por `dimensao`.
   *
   * Checklist inteiramente verde não é publicável por si só — a publicação
   * ainda recusa por conformidade legal, documento do edital e tipo de ato,
   * nenhum dos três coberto aqui. Ver `obterConformidadeLegal()`.
   */
  obterConformidade(
    processoSeletivoId: string,
  ): Observable<ApiResult<ConformidadeProcessoSeletivoDto>> {
    return this.http.get<ApiResult<ConformidadeProcessoSeletivoDto>>(
      this.rotas.doProcesso(processoSeletivoId, 'conformidade'),
      { context: withVendorMime('conformidade-processo-seletivo', 1) },
    );
  }

  /**
   * GET `/api/selecao/processos-seletivos/{id}/conformidade-legal` — as
   * obrigatoriedades legais avaliadas contra `dataReferencia`.
   *
   * `dataReferencia` é a data de início do período de inscrição do processo,
   * não um valor arbitrário do cliente — o contrato marca o parâmetro como
   * opcional, e omiti-lo deixa o servidor decidir a referência padrão.
   */
  obterConformidadeLegal(
    processoSeletivoId: string,
    dataReferencia?: string,
  ): Observable<ApiResult<ConformidadeLegalProcessoSeletivoDto>> {
    let params = new HttpParams();
    if (dataReferencia !== undefined) {
      params = params.set('dataReferencia', dataReferencia);
    }
    return this.http.get<ApiResult<ConformidadeLegalProcessoSeletivoDto>>(
      this.rotas.doProcesso(processoSeletivoId, 'conformidade-legal'),
      { params, context: withVendorMime('conformidade-legal-processo-seletivo', 1) },
    );
  }

  /**
   * POST `/api/selecao/processos-seletivos/{id}/publicacao` — publica o
   * processo.
   *
   * `periodoInscricaoInicio`/`…Fim` **não são derivados no cliente**: quando o
   * cronograma tem fase com `coletaInscricao`, os dois vão `null` e o servidor
   * usa a janela da fase (422 `PeriodoInscricaoNaoInformavel` se vierem
   * preenchidos); sem fase de coleta — certame de origem importada — os dois
   * são obrigatórios (422 `PeriodoInscricaoObrigatorioSemFaseDeColeta` se
   * vierem nulos). Quem chama decide isso antes de montar o corpo, não aqui.
   *
   * A recusa por pendência chega como `ApiResult.fail` — o `ProblemDetails` do
   * 422 é devolvido tal como o servidor emitiu, sem catch genérico que o
   * esconda do chamador.
   *
   * Responde 204 sem corpo.
   */
  publicar(
    processoSeletivoId: string,
    request: PublicarProcessoSeletivoRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.post<ApiResult<void>>(
      this.rotas.doProcesso(processoSeletivoId, 'publicacao'),
      request,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /**
   * GET `/api/selecao/processos-seletivos/{id}/snapshot-vigente` — o snapshot
   * imutável da última publicação: `snapshotPublicacaoId`, o `atoId`, a
   * `schemaVersion`, o hash do algoritmo, o hash da configuração e do
   * edital, e a `configuracao` congelada em si.
   *
   * Depois do `204` de `publicar()`, é esta leitura — ao lado
   * de `obter()` — que confirma que a versão 1 ficou vigente. O campo
   * `configuracao` é o JSON canônico congelado no instante da publicação, não
   * um DTO editável: interpretá-lo como comando de gravação reabriria um
   * rascunho que o próprio ato tornou imutável.
   */
  obterSnapshotVigente(
    processoSeletivoId: string,
    instante?: string,
  ): Observable<ApiResult<SnapshotVigenteDto>> {
    let params = new HttpParams();
    if (instante !== undefined) {
      params = params.set('instante', instante);
    }
    return this.http.get<ApiResult<SnapshotVigenteDto>>(
      this.rotas.doProcesso(processoSeletivoId, 'snapshot-vigente'),
      { params, context: withVendorMime('snapshot-vigente-processo-seletivo', 1) },
    );
  }
}
