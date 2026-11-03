import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type {
  ConfiguracaoDistribuicaoVagasDto,
  ConfiguracaoDistribuicaoVagasInput,
  DefinirCascataRemanejamentoRequest,
  DefinirOpcoesDeCursoRequest,
} from './processos-seletivos.contrato';
import { rotasDoProcesso } from './rotas-do-processo';
import { SELECAO_BASE_PATH } from './tokens';

/** Cliente da distribuição de vagas, das opções de curso e da cascata de remanejamento. */
@Injectable({ providedIn: 'root' })
export class VagasDoProcessoApi {
  private readonly http = inject(HttpClient);
  private readonly rotas = rotasDoProcesso(inject(SELECAO_BASE_PATH));

  /**
   * POST `/api/selecao/processos-seletivos/{id}/distribuicao-vagas/simulacao`
   * — devolve o quadro como a regra o calcula, sem gravar.
   *
   * É o que permite ao editor mostrar o efeito da configuração — quanto sobra
   * na ampla concorrência depois das reservas e das retiradas — sem reimplementar
   * a Lei de Cotas no cliente.
   */
  simularDistribuicaoVagas(
    processoSeletivoId: string,
    distribuicoes: readonly ConfiguracaoDistribuicaoVagasInput[],
  ): Observable<ApiResult<readonly ConfiguracaoDistribuicaoVagasDto[]>> {
    return this.http.post<ApiResult<readonly ConfiguracaoDistribuicaoVagasDto[]>>(
      this.rotas.doProcesso(processoSeletivoId, 'distribuicao-vagas', 'simulacao'),
      distribuicoes,
      { context: withVendorMime('simulacao-distribuicao-vagas', 1) },
    );
  }

  /**
   * PUT `/api/selecao/processos-seletivos/{id}/distribuicao-vagas` — substitui
   * a coleção inteira. Enviar menos ofertas do que existem apaga as demais.
   */
  definirDistribuicaoVagas(
    processoSeletivoId: string,
    distribuicoes: readonly ConfiguracaoDistribuicaoVagasInput[],
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      this.rotas.doProcesso(processoSeletivoId, 'distribuicao-vagas'),
      distribuicoes,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /**
   * PUT `/api/selecao/processos-seletivos/{id}/opcoes-de-curso` — declara quantos cursos o
   * candidato escolhe na inscrição (1 ou 2). Com a distribuição de vagas já gravada, o número
   * não pode passar da quantidade de ofertas: a recusa vem como 422 no campo `numero`.
   *
   * Responde 204 sem corpo.
   */
  definirOpcoesDeCurso(
    processoSeletivoId: string,
    request: DefinirOpcoesDeCursoRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      this.rotas.doProcesso(processoSeletivoId, 'opcoes-de-curso'),
      request,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /**
   * PUT `/api/selecao/processos-seletivos/{id}/cascata-remanejamento` —
   * grava a matriz de remanejamento entre modalidades.
   *
   * A tela não compõe `fallbackCodigo` nem `destinos[]`: o handler valida o
   * corpo célula a célula contra o `esquemaArgs` **congelado** da regra
   * escolhida e recusa com 422 (`ConfiguracaoCascataRemanejamento.MatrizDivergenteDaRegra`)
   * qualquer divergência — quem chama envia o que a regra do catálogo já
   * declarou, nunca uma composição livre.
   *
   * Responde 204 sem corpo.
   */
  definirCascataRemanejamento(
    processoSeletivoId: string,
    request: DefinirCascataRemanejamentoRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      this.rotas.doProcesso(processoSeletivoId, 'cascata-remanejamento'),
      request,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }
}
