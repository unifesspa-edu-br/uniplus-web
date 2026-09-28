import { ProblemDetails } from '@uniplus/shared-core/http';
import type { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import {
  DadosDoAtoRequest,
  ItemConformidadeDto,
  PublicarProcessoSeletivoRequest,
} from '@uniplus/shared-data/selecao';

import { PASSOS, RotuloDePasso } from '../../processo-seletivo.data';
import { FaseDoCronograma, WizardDraft } from '../../processo-seletivo.models';
import { hojeNoFusoInstitucional, instanteDoCampo } from '../../shared/fuso-institucional';

/** Sem catálogo à mão, só o que já foi hidratado do servidor decide — nunca `false` por omissão do parâmetro. */
const SEM_CATALOGO: ReadonlyMap<string, FaseCanonicaDto> = new Map();

/**
 * Se a fase coleta inscrição — o que ela congelou tem precedência, e o
 * catálogo institucional é o fallback. **A ordem importa**: uma fase
 * acrescentada nesta sessão (`acrescentarFase()` do passo Cronograma) nasce
 * com `congelados: null` — só `hidratarDraft()` a partir de um `GET /{id}`
 * preenche esse campo — e `persistir()` do Cronograma reconcilia só as
 * etapas, não as fases (`reconciliarEtapas`). Sem o fallback, uma fase de
 * coleta acrescentada e gravada na mesma sessão fica invisível para esta
 * tela até um F5, e o comando de publicação manda o período preenchido onde
 * o servidor exige `null` — 422 `PeriodoInscricaoNaoInformavel` na
 * publicação mais comum, a de processo com inscrição própria.
 */
function coletaInscricao(fase: FaseDoCronograma, fasePorId: ReadonlyMap<string, FaseCanonicaDto>): boolean {
  return fase.congelados?.coletaInscricao ?? fasePorId.get(fase.faseCanonicaId)?.coletaInscricao ?? false;
}

/**
 * A fase que ancora o período de inscrição do Edital — a de menor `ordem`
 * entre as que declaram `coletaInscricao` (espelha
 * `ProcessoSeletivo.FaseQueAncoraOPeriodoDeInscricao`, `ProcessoSeletivo.cs:3055-3058`).
 * `null` quando nenhuma fase coleta inscrição pelo sistema — o certame é de
 * origem importada.
 *
 * Duas fases de coleta não é problema desta tela: o servidor já elege a de
 * menor `ordem` deterministicamente (`ProcessoSeletivo.cs:3039-3058`), e
 * perguntar ao operador qual vale produziria `PeriodoInscricaoNaoInformavel`
 * ao enviar o que ele escolhesse.
 *
 * `fasePorId` é o catálogo de fases canônicas (`CatalogosDoCronogramaService.fasePorId`,
 * já provido na página) — ver `coletaInscricao()` para o porquê de não bastar
 * `fase.congelados`.
 */
export function faseQueAncoraOPeriodoDeInscricao(
  draft: WizardDraft,
  fasePorId: ReadonlyMap<string, FaseCanonicaDto> = SEM_CATALOGO,
): FaseDoCronograma | null {
  const fasesDeColeta = draft.cronograma.fases
    .filter((fase) => coletaInscricao(fase, fasePorId))
    .sort((a, b) => a.ordem - b.ordem);
  return fasesDeColeta[0] ?? null;
}

/**
 * ARMADILHA DO PERÍODO (`#486`, `ResolucaoDoPeriodoDeInscricao.cs:28-56`) — a
 * intuição de "derivar do cronograma e enviar" é o inverso do que o servidor
 * espera:
 *
 * - havendo fase de coleta, o servidor deriva a janela dela e recusa
 *   (`PeriodoInscricaoNaoInformavel`) se a tela mandar qualquer coisa —
 *   `numero`/período viajam com os dois campos de período em `null`;
 * - sem fase de coleta (certame de origem importada), os dois campos são
 *   obrigatórios, e omiti-los é `PeriodoInscricaoObrigatorioSemFaseDeColeta`.
 *
 * A tela nunca deriva: só decide qual dos dois ramos vale, a partir do mesmo
 * campo (`coletaInscricao`) que `hidratacao.ts` já mapeia.
 */
export function temFaseDeColetaInscricao(
  draft: WizardDraft,
  fasePorId: ReadonlyMap<string, FaseCanonicaDto> = SEM_CATALOGO,
): boolean {
  return faseQueAncoraOPeriodoDeInscricao(draft, fasePorId) !== null;
}

/**
 * O dia civil, no fuso institucional, que `GET /conformidade-legal` avalia
 * como `dataReferencia` — o mesmo instante que a publicação usaria como
 * início do período de inscrição (CA-05). `null` quando esse instante ainda
 * não é conhecido: a fase de coleta existe mas está sem janela, ou não há fase
 * de coleta e o operador ainda não informou a data — nos dois casos o
 * checklist legal fica sem prévia até a informação existir, e a leitura sem
 * `dataReferencia` deixaria o servidor usar a referência de hoje, que não é a
 * pergunta que se quer responder aqui.
 */
export function dataReferenciaLegalDe(
  draft: WizardDraft,
  fasePorId: ReadonlyMap<string, FaseCanonicaDto> = SEM_CATALOGO,
): string | null {
  const ancora = faseQueAncoraOPeriodoDeInscricao(draft, fasePorId);
  if (ancora !== null) {
    return ancora.inicio === null ? null : hojeNoFusoInstitucional(new Date(ancora.inicio));
  }

  const instante = instanteDoCampo(draft.publicacao.periodoInscricaoInicio);
  return instante === null ? null : hojeNoFusoInstitucional(new Date(instante));
}

/** Item de conformidade agrupado por `dimensao` — a navegação da Parte A é por este campo, nunca por texto (CA-04). */
export interface GrupoDeConformidade {
  readonly dimensao: string;
  readonly itens: readonly ItemConformidadeDto[];
  readonly ok: boolean;
}

/**
 * Agrupa o checklist estrutural por `dimensao`, na ordem em que os grupos
 * aparecem no vetor original. Grupo inteiramente verde é informação recolhida
 * pela própria tela (via `ok`) — não filtrado aqui, porque "nenhum item com
 * `ok: false`" é responsabilidade de quem decide se a publicação está
 * liberada, não desta função.
 */
export function agruparPorDimensao(
  itens: readonly ItemConformidadeDto[],
): readonly GrupoDeConformidade[] {
  const grupos: GrupoDeConformidade[] = [];
  const indicePorDimensao = new Map<string, number>();

  for (const item of itens) {
    const indiceExistente = indicePorDimensao.get(item.dimensao);
    if (indiceExistente === undefined) {
      indicePorDimensao.set(item.dimensao, grupos.length);
      grupos.push({ dimensao: item.dimensao, itens: [item], ok: item.ok });
      continue;
    }

    const grupo = grupos[indiceExistente];
    if (grupo === undefined) continue;
    grupos[indiceExistente] = {
      ...grupo,
      itens: [...grupo.itens, item],
      ok: grupo.ok && item.ok,
    };
  }

  return grupos;
}

/**
 * Rótulo de cada dimensão conhecida de `DimensaoConformidade` (`DimensaoConformidade.cs`). O
 * código chega em `snake_case` e sem acento (`taxa_inscricao`), e o painel é texto user-facing:
 * trocar o separador não basta, porque "Taxa inscricao" sai sem preposição e sem acento.
 *
 * `Map`, e não objeto literal, pelo mesmo motivo do mapa de passos: o código vem do servidor, e
 * um objeto responderia por chaves herdadas como `constructor`.
 */
const ROTULO_POR_DIMENSAO: ReadonlyMap<string, string> = new Map<string, string>([
  ['identificacao', 'Identificação'],
  ['taxa_inscricao', 'Taxa de inscrição'],
  ['distribuicao_vagas', 'Distribuição de vagas'],
  ['cascata_remanejamento', 'Cascata de remanejamento'],
  ['cronograma', 'Cronograma'],
  ['exigencias_documentais', 'Exigências documentais'],
  ['contagem_de_prazos', 'Contagem de prazos'],
  ['classificacao', 'Classificação'],
  ['atendimento_especializado', 'Atendimento especializado'],
  ['coleta_de_fatos', 'Coleta de fatos'],
]);

/**
 * Rótulo legível de uma dimensão vinda do contrato. Dimensão que este cliente ainda não conhece
 * — acrescentada no servidor antes de chegar aqui — cai na grafia do próprio código, sem `_`, em
 * vez de sumir do painel.
 */
export function rotuloDaDimensao(dimensao: string): string {
  const conhecido = ROTULO_POR_DIMENSAO.get(dimensao);
  if (conhecido !== undefined) return conhecido;
  const comEspacos = dimensao.replace(/_/g, ' ').trim();
  return comEspacos.charAt(0).toUpperCase() + comEspacos.slice(1);
}

/**
 * O passo do wizard dono de cada dimensão estrutural, nomeado pelo RÓTULO do passo e não
 * pelo índice: `DimensaoConformidade` é um conjunto fechado, e a navegação usa essa
 * identidade estável, nunca o texto da mensagem.
 *
 * O rótulo é a chave porque o índice literal já se desalinhou uma vez — quando "Locais de
 * prova" saiu do wizard, todos os passos seguintes andaram uma casa e este mapa ficou para
 * trás, mandando a classificação para "Atend. especial" e o atendimento para a própria tela
 * de revisão. Com o rótulo, retirar ou reordenar um passo ou o compilador recusa o mapa, ou
 * ele continua certo sozinho.
 *
 * Há dimensões cujos itens NÃO caem todos no mesmo passo (`coleta_de_fatos`,
 * `contagem_de_prazos`, `classificacao`) — por isso o destino por item logo abaixo tem
 * precedência sobre este.
 *
 * `Map`, e não objeto literal: o código da dimensão vem do servidor, e um objeto responderia
 * por chaves herdadas como `constructor`. O rótulo é `RotuloDePasso`: o compilador recusa
 * passo que não existe.
 */
const PASSO_POR_DIMENSAO: ReadonlyMap<string, RotuloDePasso> = new Map<string, RotuloDePasso>([
  // O identificador legível é declarado no passo de identificação, junto do nome.
  ['identificacao', 'Identificação'],
  ['taxa_inscricao', 'Pagamento'],
  ['distribuicao_vagas', 'Vagas'],
  // A cascata é seção do próprio passo Vagas — não um passo à parte.
  ['cascata_remanejamento', 'Vagas'],
  ['cronograma', 'Cronograma'],
  // A exigência documental é declarada na superfície da fase, dentro do passo do cronograma.
  ['exigencias_documentais', 'Cronograma'],
  // A convenção de contagem é declarada no cronograma; os demais itens desta dimensão não
  // têm passo e estão em DESTINO_POR_ITEM.
  ['contagem_de_prazos', 'Cronograma'],
  // A classificação inteira — regra de cálculo, precisão e eliminação — é gravada no
  // persistir() do passo Eliminação.
  ['classificacao', 'Eliminação'],
  ['atendimento_especializado', 'Atend. especial'],
  // O formulário de inscrição é onde os fatos coletados, as regras de derivação e a
  // referência temporal são declarados. Três itens desta dimensão se resolvem noutro passo, e
  // estão nomeados em DESTINO_POR_ITEM.
  ['coleta_de_fatos', 'Formulário'],
]);

/**
 * Onde o item se resolve: o passo que o botão abre e, quando o botão não basta, o que fazer e
 * onde. Item sem passo tem sempre orientação — sem ela, a pendência apareceria sem saída.
 */
type DestinoDoItem =
  | { readonly passo: RotuloDePasso; readonly orientacao?: string }
  | { readonly passo: null; readonly orientacao: string };

/** Cada passo pelo rótulo, com a posição dele e o nome que o painel mostra. */
const PASSO_POR_ROTULO: ReadonlyMap<RotuloDePasso, { readonly indice: number; readonly nome: string }> =
  new Map(PASSOS.map((passo, indice) => [passo.rotulo, { indice, nome: passo.revisao }]));

/**
 * A mudança feita na fórmula não é gravada pela fórmula: ela vai junto com a classificação,
 * gravada ao avançar no passo Eliminação ou pela publicação.
 */
const GRAVADA_COM_A_CLASSIFICACAO = `é gravada quando a classificação é gravada, no passo ${nomeDoPasso('Eliminação')}, ou na publicação do processo, e até lá esta pendência continua aqui`;

const REGRAVAR_VAGAS = `e depois regrave o passo ${nomeDoPasso('Vagas')}: o grupo é copiado para o processo quando a distribuição é gravada, e não se atualiza sozinho`;

/**
 * O destino de um ITEM específico, quando o passo dono da dimensão não basta: o item vai para
 * outro passo, não tem passo nenhum, ou precisa dizer o resto da correção.
 *
 * A referência temporal ilustra por que a decisão às vezes é por item: escolher QUAL fase
 * ancora a apuração da idade é do formulário, mas dar data à fase escolhida é do cronograma —
 * e mandar quem tem uma fase sem data para o formulário mostraria a âncora já declarada, sem
 * nada a corrigir ali.
 *
 * A oferta de condições de atendimento é do passo que a declara: um fato coletável de escopo
 * do processo que não tem valor nenhum ofertado se resolve ampliando a oferta, não mexendo no
 * formulário que o pergunta.
 *
 * Em `contagem_de_prazos`, o algoritmo de contagem é declarado no cronograma, mas o calendário
 * de dias úteis é cadastro de outro módulo, a localidade vem do cadastro inicial que esta
 * jornada não reabre, e o fuso não reconhecido é defeito de instalação. Mandar os três para o
 * cronograma seria oferecer uma saída que não resolve.
 *
 * No processo ENEM, a orientação aponta a correção que o operador faz e, quando ela não é
 * gravada na hora, diz quando é: "Atualizar checklist" não grava nada, e a pendência continua
 * vermelha até a gravação acontecer, o que faria a correção parecer ter falhado.
 * - A resolução de Peso por Área é escolhida no passo da fórmula, que não grava: a escolha
 *   chega ao processo quando a classificação é gravada, no passo Eliminação ou na publicação,
 *   que grava de novo todos os passos antes de conferir.
 * - O grupo de área da oferta é campo do cadastro de cursos, e o servidor confere a cópia dele
 *   guardada em cada oferta, refeita só quando a distribuição de vagas é gravada. Vale para a
 *   oferta sem grupo e para a oferta cujo grupo ficou fora do quadro: a correção é o curso, e o
 *   botão leva ao passo Vagas, que refaz a cópia.
 * - Os critérios de desempate são da dimensão da classificação, mas quem os grava é o passo
 *   Desempate. Por área, a causa pode estar no critério ou na classificação escolhida na
 *   fórmula: retirar o critério ou a área grava ao avançar; a mudança na fórmula, junto com a
 *   classificação.
 * - O divisor da média é a soma dos pesos das etapas que compõem a nota, e as etapas e os pesos
 *   são declarados no cronograma.
 */
const DESTINO_POR_ITEM: ReadonlyMap<string, DestinoDoItem> = new Map<string, DestinoDoItem>([
  ['referencia_temporal_extremo_da_fase_ausente', { passo: 'Cronograma' }],
  ['referencia_temporal_fim_inscricao_indisponivel', { passo: 'Cronograma' }],
  ['fato_coletavel_sem_valores_ofertados', { passo: 'Atend. especial' }],
  [
    'calendario_vigente_ausente',
    {
      passo: null,
      orientacao: 'Cadastre e marque como vigente um calendário de dias úteis, em Configuração.',
    },
  ],
  [
    'localidade_nao_declarada',
    {
      passo: null,
      orientacao:
        'A localidade que rege os prazos vem do cadastro inicial do processo, que esta jornada não reabre.',
    },
  ],
  [
    'fuso_institucional_nao_reconhecido',
    {
      passo: null,
      orientacao: 'O fuso institucional não foi reconhecido pelo servidor. Acione o suporte técnico.',
    },
  ],
  [
    'classificacao_resolucao_peso_area_enem_ausente',
    {
      passo: 'Fórmula e precisão',
      orientacao: `Escolha a resolução de Peso por Área. A escolha ${GRAVADA_COM_A_CLASSIFICACAO}.`,
    },
  ],
  [
    'classificacao_grupo_area_enem_da_oferta_fora_do_quadro',
    {
      passo: 'Vagas',
      orientacao: `Corrija o grupo de área do ENEM no cadastro do curso, em Configuração, ${REGRAVAR_VAGAS}.`,
    },
  ],
  [
    'distribuicao_vagas_oferta_sem_grupo_area_enem',
    {
      passo: 'Vagas',
      orientacao: `Declare o grupo de área do ENEM no cadastro do curso, em Configuração, ${REGRAVAR_VAGAS}.`,
    },
  ],
  [
    'classificacao_divisor_media_invalido',
    {
      passo: 'Cronograma',
      orientacao:
        'Declare ao menos uma etapa classificatória (ou ambas) com peso maior que zero: a média da nota final divide pela soma desses pesos.',
    },
  ],
  ['criterios_desempate_em_excesso', { passo: 'Desempate' }],
  ['desempate_area_enem_areas_mal_formadas', { passo: 'Desempate' }],
  ['desempate_area_enem_citada_por_dois_criterios', { passo: 'Desempate' }],
  [
    'desempate_area_enem_sem_quadro',
    {
      passo: 'Desempate',
      orientacao: `Retire o critério por área, ou declare no passo ${nomeDoPasso('Fórmula e precisão')} a classificação baseada em ENEM com média ponderada e escolha a resolução de Peso por Área. A mudança na fórmula ${GRAVADA_COM_A_CLASSIFICACAO}.`,
    },
  ],
  [
    'desempate_area_enem_fora_do_quadro',
    {
      passo: 'Desempate',
      orientacao: `Retire a área do critério, ou escolha no passo ${nomeDoPasso('Fórmula e precisão')} uma resolução de Peso por Área que tenha a área em todos os grupos. A mudança na fórmula ${GRAVADA_COM_A_CLASSIFICACAO}.`,
    },
  ],
]);

/**
 * O passo dado pelo rótulo. O rótulo é tipado pela própria lista de passos, então um passo
 * inexistente é defeito de programação: falha alto em vez de devolver um valor que pareça
 * válido.
 */
function passoPeloRotulo(rotulo: RotuloDePasso): { readonly indice: number; readonly nome: string } {
  const passo = PASSO_POR_ROTULO.get(rotulo);
  if (passo === undefined) throw new Error(`O passo "${rotulo}" não existe no wizard.`);
  return passo;
}

/** O nome do passo, dado pelo rótulo, como o painel o mostra no botão e na orientação. */
export function nomeDoPasso(rotulo: RotuloDePasso): string {
  return passoPeloRotulo(rotulo).nome;
}

function destinoDoItem(codigo: string, dimensao: string): DestinoDoItem | null {
  const doItem = DESTINO_POR_ITEM.get(codigo);
  if (doItem !== undefined) return doItem;
  const passo = PASSO_POR_DIMENSAO.get(dimensao);
  return passo === undefined ? null : { passo };
}

/** Item do checklist estrutural como o painel de revisão o mostra. */
export interface ItemDaRevisao {
  readonly codigo: string;
  readonly mensagem: string;
  readonly ok: boolean;
  readonly idDaMensagem: string;
  /** `null` quando o item está conforme, ou quando o botão do passo basta. */
  readonly orientacao: { readonly id: string; readonly texto: string } | null;
  /** `null` quando o item está conforme, ou quando nenhum passo o resolve. */
  readonly passo: { readonly indice: number; readonly nome: string } | null;
}

export interface GrupoDaRevisao {
  readonly dimensao: string;
  readonly ok: boolean;
  readonly itens: readonly ItemDaRevisao[];
}

function idDoItem(codigo: string, parte: 'mensagem' | 'orientacao'): string {
  return `rev-item-${codigo}-${parte}`;
}

function comoItemDaRevisao(item: ItemConformidadeDto): ItemDaRevisao {
  const { codigo, mensagem, ok } = item;
  const idDaMensagem = idDoItem(codigo, 'mensagem');
  if (ok) {
    return { codigo, mensagem, ok, idDaMensagem, orientacao: null, passo: null };
  }

  const destino = destinoDoItem(codigo, item.dimensao);
  const texto = destino?.orientacao;
  const orientacao = texto === undefined ? null : { id: idDoItem(codigo, 'orientacao'), texto };
  const passo = destino?.passo == null ? null : passoPeloRotulo(destino.passo);
  return { codigo, mensagem, ok, idDaMensagem, orientacao, passo };
}

/** Os grupos do checklist com o que o painel mostra de cada item, calculado uma vez. */
export function comoGruposDaRevisao(
  grupos: readonly GrupoDeConformidade[],
): readonly GrupoDaRevisao[] {
  return grupos.map((grupo) => ({ ...grupo, itens: grupo.itens.map(comoItemDaRevisao) }));
}

/**
 * Recusas nomeadas que nenhum dos dois checklists cobre (`#486`, Parte A, bloco 3).
 *
 * São os códigos do WIRE (`uniplus.<modulo>.<razao>`), que é o que
 * `problem.code` carrega: `DomainErrorProblemDetailsFactory.Resolve` grava ali
 * sempre o `DomainErrorMapping.Code`, e o código de domínio
 * (`ProcessoSeletivo.*`) é chave de lookup do servidor — não trafega (`#743`).
 *
 * O conjunto é o que `PublicarProcessoSeletivoCommandHandler` e
 * `ConferenciaDoTipoDeAto` de fato emitem sobre documento e ato.
 */
const CODIGOS_DE_DOCUMENTO_OU_ATO = new Set<string>([
  'uniplus.selecao.processo_seletivo.documento_nao_encontrado',
  'uniplus.selecao.processo_seletivo.documento_nao_confirmado',
  'uniplus.selecao.processo_seletivo.tipo_de_ato_sem_versao_vigente',
  'uniplus.selecao.processo_seletivo.tipo_de_ato_nao_congela_configuracao',
  'uniplus.selecao.processo_seletivo.objeto_ja_tem_ato_vivo_do_tipo',
]);

export function eErroDeDocumentoOuAto(codigo: string): boolean {
  return CODIGOS_DE_DOCUMENTO_OU_ATO.has(codigo);
}

/**
 * Recusas de `GET /conformidade-legal` que NÃO são falha de carga: o servidor
 * entendeu o pedido e respondeu que ainda não há como avaliar, porque o
 * rascunho não tem de onde derivar a data de referência (`uniplus-api#1456`).
 *
 * São os mesmos três códigos que o gate de publicação emitiria, na mesma ordem
 * em que ele os emite, e é por isso que a tela pode repeti-los ao operador como
 * pendência a resolver — o que falta aqui é exatamente o que faltaria lá:
 *
 * - `inscricao_propria_sem_fase_de_coleta` — criar a fase que coleta, no Cronograma;
 * - `fase_que_coleta_inscricao_sem_janela` — dar início e fim à fase, no Cronograma;
 * - `periodo_inscricao_obrigatorio_sem_fase_de_coleta` — informar o período aqui,
 *   no bloco do ato, e só no certame de origem importada.
 *
 * Tratá-los como falha de carga mandava "tente novamente" para quem precisava,
 * na verdade, mexer no cronograma ou preencher o período.
 */
const CODIGOS_DE_CONFORMIDADE_LEGAL_NAO_AVALIAVEL = new Set<string>([
  'uniplus.selecao.processo_seletivo.inscricao_propria_sem_fase_de_coleta',
  'uniplus.selecao.processo_seletivo.fase_que_coleta_inscricao_sem_janela',
  'uniplus.selecao.processo_seletivo.periodo_inscricao_obrigatorio_sem_fase_de_coleta',
]);

/**
 * O motivo pelo qual a conformidade legal não pôde ser avaliada, ou `null`
 * quando a resposta não é uma dessas pendências — e aí é falha de carga, que
 * o preflight trata como sempre tratou.
 *
 * Compara contra a taxonomia `uniplus.*`, que é o que `Extensions["code"]`
 * carrega no wire; o código de domínio (`ProcessoSeletivo.*`) é chave de
 * lookup do servidor e não trafega.
 */
export function motivoDeConformidadeLegalNaoAvaliavel(problem: ProblemDetails): string | null {
  if (!CODIGOS_DE_CONFORMIDADE_LEGAL_NAO_AVALIAVEL.has(problem.code)) return null;
  return problem.detail?.trim() || problem.title;
}

/**
 * Uma pendência estrutural, como `Extensions["pendencias"]` do 422 as
 * devolve (`ProcessoSeletivoController.cs:785-791`) — mesmo shape de
 * `ItemConformidadeDto` sem o `ok` (todo item aqui já é reprovado).
 */
export interface PendenciaEstruturalProblem {
  readonly codigo: string;
  readonly dimensao: string;
  readonly mensagem: string;
}

/**
 * Uma obrigatoriedade legal reprovada, como
 * `Extensions["obrigatoriedadesReprovadas"]` do 422 as devolve
 * (`ProcessoSeletivoController.cs:803-825`) quando o erro é
 * `ConformidadeLegalInsuficiente`.
 */
export interface ObrigatoriedadeReprovadaProblem {
  readonly regraCodigo: string;
  readonly descricaoHumana: string;
  readonly baseLegal: string;
  readonly motivo: string | null;
  /**
   * Onde a norma pode ser lida, e desde quando ela vige. Só existem quando a reprovação vem da
   * consulta de conformidade legal — a extension do 422 carrega os quatro campos acima e mais
   * nada. Sem eles, quem monta o edital lê "reprovada — Lei 12.711/2012" e não tem por onde
   * chegar ao texto que o reprovou.
   */
  readonly atoNormativoUrl?: string | null;
  readonly portariaInterna?: string | null;
  readonly vigenciaInicio?: string | null;
}

/**
 * `ProblemDetails` com as duas extensions que só `POST …/publicacao` emite.
 * Não entra no tipo compartilhado de `shared-core` porque as duas são de um
 * endpoint só — a leitura aqui é local e explícita sobre isso, no molde de
 * como `legalReference` já é tratado no wire format genérico (ADR-0023).
 */
export interface ProblemComExtensoesDePublicacao extends ProblemDetails {
  readonly pendencias?: readonly PendenciaEstruturalProblem[];
  readonly obrigatoriedadesReprovadas?: readonly ObrigatoriedadeReprovadaProblem[];
}

export function comExtensoesDePublicacao(
  problem: ProblemDetails,
): ProblemComExtensoesDePublicacao {
  return problem as ProblemComExtensoesDePublicacao;
}

/** Texto vazio vira `null` — nulo é o que os dois campos de período recebem quando não se aplicam. */
function naoVazio(texto: string): string | null {
  const limpo = texto.trim();
  return limpo === '' ? null : limpo;
}

function inteiro(texto: string): number | null {
  const limpo = texto.trim();
  return /^\d+$/.test(limpo) ? Number(limpo) : null;
}

/**
 * Mensagens do que falta preencher **localmente** antes de tentar publicar —
 * o complemento de `validarRascunho()` da página (CA-01): campo em branco
 * nesta própria tela, que nenhum passo anterior grava. Não substitui o
 * checklist do servidor; convive com ele em bloco separado.
 */
export function mensagensDePublicacao(
  draft: WizardDraft,
  documentoEditalId: string | null,
  fasePorId: ReadonlyMap<string, FaseCanonicaDto> = SEM_CATALOGO,
): string[] {
  const mensagens: string[] = [];
  const publicacao = draft.publicacao;

  if (documentoEditalId === null) {
    mensagens.push(
      'Escolha o documento do edital confirmado que será publicado, na Identificação.',
    );
  }

  if (!temFaseDeColetaInscricao(draft, fasePorId)) {
    const inicio = instanteDoCampo(publicacao.periodoInscricaoInicio);
    const fim = instanteDoCampo(publicacao.periodoInscricaoFim);

    if (inicio === null) {
      mensagens.push(
        'Informe o início do período de inscrição — o cronograma não tem fase que colete inscrição pelo sistema.',
      );
    }
    if (fim === null) {
      mensagens.push(
        'Informe o fim do período de inscrição — o cronograma não tem fase que colete inscrição pelo sistema.',
      );
    }
    // Descobrir que o período está invertido DEPOIS de confirmar a publicação é o pior
    // momento possível: é o único clique do wizard que não se desfaz.
    if (inicio !== null && fim !== null && fim < inicio) {
      mensagens.push('O fim do período de inscrição não pode anteceder o início.');
    }
  }

  if (!publicacao.ato.orgao.trim()) mensagens.push('Informe o órgão do ato de publicação.');
  if (!publicacao.ato.serie.trim()) mensagens.push('Informe a série do ato de publicação.');

  // Ano precisa ser POSITIVO, não apenas legível: `0` atravessa `inteiro()` como número
  // válido e só é recusado pelo servidor, depois de o operador ter confirmado a publicação
  // num diálogo que exibia "Ano: 0".
  const ano = inteiro(publicacao.ato.ano);
  if (ano === null || ano <= 0) mensagens.push('Informe o ano do ato de publicação.');

  if (!publicacao.ato.dataPublicacao.trim())
    mensagens.push('Informe a data de publicação do ato.');
  if (!publicacao.ato.assinante.trim()) mensagens.push('Informe quem assina o ato.');
  if (!publicacao.ato.tipoAtoCodigo.trim()) mensagens.push('Selecione o tipo do ato.');

  mensagens.push(...excessosDeComprimento(publicacao));

  return mensagens;
}

/**
 * Os comprimentos que o servidor recusa. São limites de coluna, e colar o nome completo de um
 * órgão com a hierarquia inteira estoura o de duzentos — hoje só no 422, depois de confirmada
 * a publicação.
 */
const COMPRIMENTO_MAXIMO: readonly { readonly campo: string; readonly rotulo: string; readonly maximo: number }[] = [
  { campo: 'numero', rotulo: 'O número do ato', maximo: 60 },
  { campo: 'orgao', rotulo: 'O órgão do ato', maximo: 200 },
  { campo: 'serie', rotulo: 'A série do ato', maximo: 100 },
  { campo: 'assinante', rotulo: 'O nome de quem assina o ato', maximo: 200 },
];

function excessosDeComprimento(publicacao: WizardDraft['publicacao']): readonly string[] {
  const valores: Readonly<Record<string, string>> = {
    numero: publicacao.numero,
    orgao: publicacao.ato.orgao,
    serie: publicacao.ato.serie,
    assinante: publicacao.ato.assinante,
  };

  return COMPRIMENTO_MAXIMO.filter(
    ({ campo, maximo }) => (valores[campo] ?? '').trim().length > maximo,
  ).map(
    ({ rotulo, maximo }) => `${rotulo} passa de ${maximo} caracteres, que é o limite do registro.`,
  );
}

/**
 * Monta o `PublicarProcessoSeletivoRequest`. Chamar só depois de
 * `mensagensDePublicacao` devolver vazio — não revalida os campos do `ato`,
 * que o contrato exige sempre presentes.
 */
export function comoComandoDePublicacao(
  draft: WizardDraft,
  documentoEditalId: string,
  fasePorId: ReadonlyMap<string, FaseCanonicaDto> = SEM_CATALOGO,
): PublicarProcessoSeletivoRequest {
  const publicacao = draft.publicacao;
  const temFase = temFaseDeColetaInscricao(draft, fasePorId);

  const ato: DadosDoAtoRequest = {
    orgao: publicacao.ato.orgao.trim(),
    serie: publicacao.ato.serie.trim(),
    ano: inteiro(publicacao.ato.ano) ?? 0,
    dataPublicacao: publicacao.ato.dataPublicacao.trim(),
    assinante: publicacao.ato.assinante.trim(),
    tipoAtoCodigo: publicacao.ato.tipoAtoCodigo.trim(),
  };

  return {
    numero: naoVazio(publicacao.numero),
    // Ver `temFaseDeColetaInscricao`: nos dois ramos o valor que NÃO se aplica
    // vai `null` explícito, nunca omitido nem inventado.
    periodoInscricaoInicio: temFase ? null : instanteDoCampo(publicacao.periodoInscricaoInicio),
    periodoInscricaoFim: temFase ? null : instanteDoCampo(publicacao.periodoInscricaoFim),
    documentoEditalId,
    ato,
  };
}
