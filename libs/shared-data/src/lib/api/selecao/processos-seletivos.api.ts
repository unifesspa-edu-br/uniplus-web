import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, VENDOR_MIME_TOKEN, withVendorMime } from '@uniplus/shared-core/http';
import type {
  AplicacaoDeModeloDto,
  AplicacaoDeModeloInput,
  ConfiguracaoDistribuicaoVagasDto,
  ConfiguracaoDistribuicaoVagasInput,
  CriarProcessoSeletivoCommand,
  CriterioDesempateInput,
  DefinirAlgoritmoContagemPrazoRequest,
  DefinirBonusRegionalRequest,
  DefinirCascataRemanejamentoRequest,
  DefinirClassificacaoRequest,
  DefinirFormularioRequest,
  DefinirIdentificadorLegivelRequest,
  DefinirItensDoFormularioRequest,
  DefinirOfertaAtendimentoRequest,
  DefinirOpcoesDeCursoRequest,
  DefinirOpcoesDeclaradasRequest,
  DefinirReferenciaTemporalFatosRequest,
  DefinirTaxaInscricaoRequest,
  DefinirTermosDoFormularioRequest,
  EtapaProcessoInput,
  FaseCronogramaInput,
  FormularioRenderizavelDto,
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
   * PUT `/api/selecao/processos-seletivos/{id}/referencia-temporal-fatos` — declara o instante
   * contra o qual a idade do candidato é apurada.
   *
   * Uma política por certame, e ela ancora TODOS os gatilhos por idade dele. Exigida quando
   * alguma exigência condiciona por faixa etária: sem ela, a publicação é recusada, porque não
   * há fallback implícito para "quantos anos o candidato tinha". Enviar tudo nulo remove.
   *
   * Responde 204 sem corpo.
   */
  definirReferenciaTemporalFatos(
    processoSeletivoId: string,
    request: DefinirReferenciaTemporalFatosRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      this.rotas.doProcesso(processoSeletivoId, 'referencia-temporal-fatos'),
      request,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /**
   * PUT `/api/selecao/admin/processos-seletivos/{id}/formularios/{finalidade}` — cria ou
   * substitui o cabeçalho do formulário de uma finalidade (inscrição, isenção da taxa,
   * habilitação — ADR-0136): a fase em que é respondido, o título e as etapas. Na inscrição, a
   * API repõe a seção dos dados básicos.
   *
   * A leitura vem com o processo (`ProcessoSeletivoDto.formularios`). As escritas são três,
   * separadas porque a API confere cada parte contra o que está gravado da outra: o cabeçalho,
   * os itens e grupos, e os termos. O `If-Match` é aceito e ignorado no rascunho.
   *
   * Responde 204 sem corpo.
   */
  definirCabecalhoDoFormulario(
    processoSeletivoId: string,
    finalidade: string,
    request: DefinirFormularioRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      this.urlDoFormulario(processoSeletivoId, finalidade),
      request,
      {
        context,
        headers: new HttpHeaders({ Accept: 'application/json' }),
      },
    );
  }

  /**
   * PUT `…/formularios/{finalidade}/itens` — substitui os itens e os grupos; `grupos` nulo deixa
   * os grupos como estão. Exige o formulário criado. Responde 204 sem corpo.
   */
  definirItensDoFormulario(
    processoSeletivoId: string,
    finalidade: string,
    request: DefinirItensDoFormularioRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.urlDoFormulario(processoSeletivoId, finalidade)}/itens`,
      request,
      {
        context,
        headers: new HttpHeaders({ Accept: 'application/json' }),
      },
    );
  }

  /** PUT `…/formularios/{finalidade}/termos` — substitui os termos exigidos. Responde 204 sem corpo. */
  definirTermosDoFormulario(
    processoSeletivoId: string,
    finalidade: string,
    request: DefinirTermosDoFormularioRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.urlDoFormulario(processoSeletivoId, finalidade)}/termos`,
      request,
      {
        context,
        headers: new HttpHeaders({ Accept: 'application/json' }),
      },
    );
  }

  /**
   * DELETE `…/formularios/{finalidade}` — só em rascunho; a inscrição é recusada se outra
   * finalidade cita fato dela. Responde 204 sem corpo.
   */
  removerFormulario(
    processoSeletivoId: string,
    finalidade: string,
    context?: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(this.urlDoFormulario(processoSeletivoId, finalidade), {
      context,
    });
  }

  /**
   * POST `…/formularios/aplicacoes-de-modelo` — copia o modelo para o processo: o formulário da
   * finalidade do modelo é criado ou substituído por inteiro, e a resposta relata o que a cópia
   * trouxe, manteve, descartou e derivou. Só em rascunho. A fase do formulário que já existia é
   * preservada; o que nasce pela aplicação fica sem fase até o cabeçalho declará-la.
   *
   * Responde com media type próprio, então o `Accept` é o do recurso; a Idempotency-Key vem do
   * `context` de quem chama.
   */
  aplicarModeloDeFormulario(
    processoSeletivoId: string,
    request: AplicacaoDeModeloInput,
    context: HttpContext,
  ): Observable<ApiResult<AplicacaoDeModeloDto>> {
    return this.http.post<ApiResult<AplicacaoDeModeloDto>>(
      this.rotas.doProcessoNaAdministracao(
        processoSeletivoId,
        'formularios',
        'aplicacoes-de-modelo',
      ),
      request,
      {
        context: context.set(VENDOR_MIME_TOKEN, {
          resource: 'aplicacao-de-modelo-formulario',
          version: 1,
        }),
      },
    );
  }

  /**
   * GET `/api/selecao/admin/processos-seletivos/{id}/formularios/{finalidade}/renderizavel` — o
   * formulário da finalidade pronto para o candidato ver, com as regras que o interpretador avalia,
   * montado da configuração viva: serve também ao rascunho, para a simulação.
   */
  obterFormularioRenderizavel(
    processoSeletivoId: string,
    finalidade: string,
  ): Observable<ApiResult<FormularioRenderizavelDto>> {
    return this.http.get<ApiResult<FormularioRenderizavelDto>>(
      `${this.urlDoFormulario(processoSeletivoId, finalidade)}/renderizavel`,
      {
        context: withVendorMime('formulario', 2),
      },
    );
  }

  private urlDoFormulario(processoSeletivoId: string, finalidade: string): string {
    return this.rotas.doProcessoNaAdministracao(processoSeletivoId, 'formularios', finalidade);
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
