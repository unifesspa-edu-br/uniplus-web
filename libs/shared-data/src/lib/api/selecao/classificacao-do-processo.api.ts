import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult } from '@uniplus/shared-core/http';
import type {
  CriterioDesempateInput,
  DefinirBonusRegionalRequest,
  DefinirClassificacaoRequest,
  DefinirOpcoesDeclaradasRequest,
} from './processos-seletivos.contrato';
import { rotasDoProcesso } from './rotas-do-processo';
import { SELECAO_BASE_PATH } from './tokens';

/** Cliente da classificação, das opções declaradas, do bônus regional e do desempate. */
@Injectable({ providedIn: 'root' })
export class ClassificacaoDoProcessoApi {
  private readonly http = inject(HttpClient);
  private readonly rotas = rotasDoProcesso(inject(SELECAO_BASE_PATH));

  /**
   * PUT `/api/selecao/processos-seletivos/{id}/classificacao` — declara num
   * corpo único a regra de cálculo, a precisão, a ordem de alocação, o número
   * de opções e o vetor de regras de eliminação (UNI-REQ-0482).
   *
   * `regraArredondamentoCodigo`/`…Versao`/`casasArredondamento` viajam `null`
   * quando a regra de cálculo é `CLASSIFICACAO-IMPORTADA` (INV-B8) — o
   * mapeador que monta este corpo é quem decide isso, não este método.
   *
   * Responde 204 sem corpo.
   */
  definirClassificacao(
    processoSeletivoId: string,
    request: DefinirClassificacaoRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      this.rotas.doProcesso(processoSeletivoId, 'classificacao'),
      request,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /**
   * PUT `/api/selecao/processos-seletivos/{id}/fatos/{fatoCodigo}/opcoes` — substitui as opções
   * que o processo declara para um fato cuja fonte de valores é o próprio processo, como as
   * edições do ENEM aceitas. A lista vem na ordem em que o candidato a vê.
   *
   * Responde 204 sem corpo.
   */
  definirOpcoesDeclaradas(
    processoSeletivoId: string,
    fatoCodigo: string,
    request: DefinirOpcoesDeclaradasRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      this.rotas.doProcesso(processoSeletivoId, 'fatos', fatoCodigo, 'opcoes'),
      request,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /**
   * PUT `/api/selecao/processos-seletivos/{id}/bonus-regional` — declara se o
   * processo aplica o Fator de Atenuação das Desigualdades de Acesso (UNI-REQ-0015). `aplica` é obrigatório: `false`
   * declara "sem bônus" e vai com os cinco campos `null`; `true` exige a
   * configuração do bônus.
   *
   * Responde 204 sem corpo.
   */
  definirBonusRegional(
    processoSeletivoId: string,
    request: DefinirBonusRegionalRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      this.rotas.doProcesso(processoSeletivoId, 'bonus-regional'),
      request,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /**
   * PUT `/api/selecao/processos-seletivos/{id}/criterios-desempate` —
   * substitui a coleção inteira de critérios de desempate, na ordem em que
   * serão avaliados. Coleção vazia é estado válido: processo sem critério de
   * desempate declarado.
   *
   * Responde 204 sem corpo.
   */
  definirCriteriosDesempate(
    processoSeletivoId: string,
    criterios: readonly CriterioDesempateInput[],
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      this.rotas.doProcesso(processoSeletivoId, 'criterios-desempate'),
      criterios,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }
}
