import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import { DefinirTaxaInscricaoRequestFundamentos } from './schema';
import type { components } from './schema';
import { SELECAO_BASE_PATH } from './tokens';

export type CriarProcessoSeletivoCommand = components['schemas']['CriarProcessoSeletivoCommand'];
export type ProcessoSeletivoDto = components['schemas']['ProcessoSeletivoDto'];
export type ProcessoSeletivoResumoDto = components['schemas']['ProcessoSeletivoResumoDto'];
export type TipoProcessoSnapshotDto = components['schemas']['TipoProcessoSnapshotDto'];
export type IniciarUploadDocumentoEditalDto =
  components['schemas']['IniciarUploadDocumentoEditalDto'];
export type DocumentoEditalDto = components['schemas']['DocumentoEditalDto'];
export type AcessoDocumentoEditalDto = components['schemas']['AcessoDocumentoEditalDto'];
export type ConfiguracaoTaxaInscricaoDto = components['schemas']['ConfiguracaoTaxaInscricaoDto'];
export type DefinirTaxaInscricaoRequest = components['schemas']['DefinirTaxaInscricaoRequest'];
export type FundamentoIsencaoDto = components['schemas']['FundamentoIsencaoDto'];

/** Vocabulário fechado dos fundamentos que a configuração pode referenciar. */
export { DefinirTaxaInscricaoRequestFundamentos as FundamentoIsencao };
export type FundamentoIsencaoCodigo = DefinirTaxaInscricaoRequestFundamentos;
export type ConfiguracaoDistribuicaoVagasInput =
  components['schemas']['ConfiguracaoDistribuicaoVagasInput'];
export type ConfiguracaoDistribuicaoVagasDto =
  components['schemas']['ConfiguracaoDistribuicaoVagasDto'];
export type EtapaProcessoInput = components['schemas']['EtapaProcessoInput'];
export type EtapaProcessoDto = components['schemas']['EtapaProcessoDto'];
export type FaseCronogramaInput = components['schemas']['FaseCronogramaInput'];
export type FaseCronogramaDto = components['schemas']['FaseCronogramaDto'];
export type RegraRecursoFaseInput = components['schemas']['RegraRecursoFaseInput'];
export type DefinirAlgoritmoContagemPrazoRequest =
  components['schemas']['DefinirAlgoritmoContagemPrazoRequest'];
export type DefinirOfertaAtendimentoRequest =
  components['schemas']['DefinirOfertaAtendimentoRequest'];
export type DefinirCascataRemanejamentoRequest =
  components['schemas']['DefinirCascataRemanejamentoRequest'];
export type DestinoRemanejamentoInput = components['schemas']['DestinoRemanejamentoInput'];
export type ConformidadeProcessoSeletivoDto =
  components['schemas']['ConformidadeProcessoSeletivoDto'];
export type ItemConformidadeDto = components['schemas']['ItemConformidadeDto'];
export type ConformidadeLegalProcessoSeletivoDto =
  components['schemas']['ConformidadeLegalProcessoSeletivoDto'];
export type RegraAvaliadaDto = components['schemas']['RegraAvaliadaDto'];
export type PublicarProcessoSeletivoRequest =
  components['schemas']['PublicarProcessoSeletivoRequest'];
export type DadosDoAtoRequest = components['schemas']['DadosDoAtoRequest'];
export type ReferenciaRegraDto = components['schemas']['ReferenciaRegraDto'];
export type ConfiguracaoClassificacaoDto = components['schemas']['ConfiguracaoClassificacaoDto'];
export type DefinirClassificacaoRequest = components['schemas']['DefinirClassificacaoRequest'];
export type RegraEliminacaoDto = components['schemas']['RegraEliminacaoDto'];
export type RegraEliminacaoInput = components['schemas']['RegraEliminacaoInput'];
export type ConfiguracaoBonusRegionalDto = components['schemas']['ConfiguracaoBonusRegionalDto'];
export type DefinirBonusRegionalRequest = components['schemas']['DefinirBonusRegionalRequest'];
export type CriterioDesempateDto = components['schemas']['CriterioDesempateDto'];
export type CriterioDesempateInput = components['schemas']['CriterioDesempateInput'];
export type SnapshotVigenteDto = components['schemas']['SnapshotVigenteDto'];

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
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/distribuicao-vagas/simulacao`,
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
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/distribuicao-vagas`,
      distribuicoes,
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
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/etapas`,
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
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/cronograma-fases`,
      fases,
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
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/algoritmo-contagem-prazo`,
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
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/oferta-atendimento`,
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
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/cascata-remanejamento`,
      request,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

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
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/conformidade`,
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
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/conformidade-legal`,
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
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/publicacao`,
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
   * CA-08 da #486: depois do `204` de `publicar()`, é esta leitura — ao lado
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
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/snapshot-vigente`,
      { params, context: withVendorMime('snapshot-vigente-processo-seletivo', 1) },
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
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/classificacao`,
      request,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /**
   * PUT `/api/selecao/processos-seletivos/{id}/bonus-regional` — declara o
   * bônus regional (RN05). Toggle por presença: enviar os cinco campos `null`
   * é a forma de declarar "sem bônus" — não existe "desmarcar" separado.
   *
   * Responde 204 sem corpo.
   */
  definirBonusRegional(
    processoSeletivoId: string,
    request: DefinirBonusRegionalRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/bonus-regional`,
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
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/criterios-desempate`,
      criterios,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
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

  /**
   * GET `/api/selecao/processos-seletivos/{id}/documentos-edital` — todos os
   * documentos do edital registrados no processo, pendentes e confirmados.
   *
   * É a leitura que permite retomar o anexo depois de um refresh: o cliente
   * não guarda o `documentoEditalId` nem a URL assinada, então é daqui que o
   * editor descobre o que já existe. Havendo mais de um documento confirmado,
   * a escolha do oficial é do administrador — `criadoEm` e `confirmadoEm`
   * servem para apresentá-los, não para o frontend eleger o mais recente.
   *
   * A coleção não é paginada: um processo tem poucos documentos por natureza.
   */
  listarDocumentosEdital(
    processoSeletivoId: string,
  ): Observable<ApiResult<readonly DocumentoEditalDto[]>> {
    return this.http.get<ApiResult<readonly DocumentoEditalDto[]>>(
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/documentos-edital`,
      { context: withVendorMime('documento-edital', 1) },
    );
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
      `${this.basePath}/api/selecao/fundamentos-isencao`,
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
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/taxa-inscricao`,
      request,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /**
   * GET `/api/selecao/processos-seletivos/{id}/documentos-edital/{docId}/acesso`
   * — pede o acesso de leitura a um documento confirmado, para conferir o PDF
   * anexado.
   *
   * A URL vem assinada e com validade curta, e é emitida a cada chamada: o
   * servidor não a distribui na listagem justamente para que o prazo comece
   * quando o acesso é pedido. Pelo mesmo motivo ela não é guardada aqui — quem
   * a tem abre o arquivo sem passar por autorização de novo.
   */
  obterAcessoDocumentoEdital(
    processoSeletivoId: string,
    documentoEditalId: string,
  ): Observable<ApiResult<AcessoDocumentoEditalDto>> {
    return this.http.get<ApiResult<AcessoDocumentoEditalDto>>(
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}/documentos-edital/${encodeURIComponent(documentoEditalId)}/acesso`,
      { context: withVendorMime('acesso-documento-edital', 1) },
    );
  }

  /**
   * POST `/api/selecao/processos-seletivos/{id}/documentos-edital` — primeiro
   * dos três passos do anexo do edital: cria o registro pendente e devolve a
   * URL pré-assinada de PUT, o content type que a assinatura exige e o
   * instante em que ela expira. O endpoint não recebe corpo.
   */
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

  /**
   * Terceiro passo: a API lê o objeto no storage, confere content type,
   * tamanho e assinatura de arquivo, calcula o hash e sela o documento como
   * imutável. Também não recebe corpo.
   *
   * O segundo passo — o PUT na URL pré-assinada — não é rota do Uni+ e não
   * devolve `ApiResult`: fica no `SignedUploadClient` de `shared-core/http`.
   */
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
