import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type {
  ConfiguracaoDistribuicaoVagasDto,
  ConfiguracaoDistribuicaoVagasInput,
  CriarProcessoSeletivoCommand,
  DefinirAlgoritmoContagemPrazoRequest,
  DefinirCascataRemanejamentoRequest,
  DefinirIdentificadorLegivelRequest,
  DefinirOfertaAtendimentoRequest,
  DefinirOpcoesDeCursoRequest,
  DefinirTaxaInscricaoRequest,
  EtapaProcessoInput,
  FaseCronogramaInput,
  FundamentoIsencaoDto,
  NoExigenciaInput,
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
   * PUT `/api/selecao/processos-seletivos/{id}/etapas` — substitui a coleção
   * inteira de etapas pontuadas.
   *
   * Enviar menos etapas do que existem remove as ausentes, e é assim que uma
   * etapa sai da configuração. Coleção vazia é estado válido: processo sem
   * prova — classificação importada — não tem etapa pontuada, e o servidor a
   * aceita sem inventar nenhuma.
   *
   * O `id` de cada item é opcional e **deve ser reenviado** quando a etapa já
   * existe: é ele que critério de desempate e regra de eliminação referenciam,
   * e omiti-lo faria o servidor criar outra etapa, deixando as referências
   * apontando para uma que deixou de existir.
   *
   * Responde 204 sem corpo.
   */
  definirEtapas(
    processoSeletivoId: string,
    etapas: readonly EtapaProcessoInput[],
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      this.rotas.doProcesso(processoSeletivoId, 'etapas'),
      etapas,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /**
   * PUT `/api/selecao/processos-seletivos/{id}/cronograma-fases` — substitui o
   * cronograma inteiro.
   *
   * A janela de cada fase é **instante**, não data: o servidor normaliza para
   * UTC preservando o momento, e o deslocamento com que o cliente escreve é
   * transporte. Enviar só a data perderia a hora que separa "encerra dia 20" de
   * "encerra 20/03 às 23:59:59".
   *
   * Não há campo de `id` na entrada — a reconciliação do servidor é por
   * `faseCanonicaId`, que é a identidade estável de uma fase no cronograma.
   *
   * Responde 204 sem corpo.
   */
  definirCronogramaFases(
    processoSeletivoId: string,
    fases: readonly FaseCronogramaInput[],
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      this.rotas.doProcesso(processoSeletivoId, 'cronograma-fases'),
      fases,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /**
   * PUT `/api/selecao/processos-seletivos/{id}/documentos-exigidos` — substitui
   * a árvore de exigências documentais inteira.
   *
   * A entrada é uma árvore: cada raiz é um nó `FOLHA` (um documento), `E` (todos
   * os filhos) ou `OU` (quantos `quantidadeMinima` disser). Uma lista simples de
   * documentos é uma lista de folhas, sem grupo nenhum.
   *
   * O documento em si vem por `tipoDocumentoId` — o servidor resolve o cadastro e
   * congela nome, código e categoria. `exigidoNaFaseId` é a fase em que ele é
   * exigido, e `exigidoNaEtapaId`, quando presente, a etapa daquela fase que o
   * coleta.
   *
   * Responde 204 sem corpo.
   */
  definirDocumentosExigidos(
    processoSeletivoId: string,
    raizes: readonly NoExigenciaInput[],
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      this.rotas.doProcesso(processoSeletivoId, 'documentos-exigidos'),
      raizes,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
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
   * PUT `/api/selecao/processos-seletivos/{id}/algoritmo-contagem-prazo` —
   * declara a convenção de contagem que o certame usa nos prazos que distinguem
   * dia útil, por código e versão do catálogo de regras.
   *
   * **Não aceita limpar a declaração.** Código ou versão nulos são recusados
   * com 422, ainda que o contrato tipe os dois como anuláveis — não existe
   * "desmarcar" a convenção, só trocá-la. Quem chama só dispara depois de haver
   * escolha.
   *
   * Responde 204 sem corpo.
   */
  definirAlgoritmoContagemPrazo(
    processoSeletivoId: string,
    request: DefinirAlgoritmoContagemPrazoRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      this.rotas.doProcesso(processoSeletivoId, 'algoritmo-contagem-prazo'),
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
