import { ProblemDetails } from '@uniplus/shared-core/http';
import type { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import {
  DadosDoAtoRequest,
  ItemConformidadeDto,
  PublicarProcessoSeletivoRequest,
} from '@uniplus/shared-data/selecao';

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
 * Rótulo legível de uma dimensão vinda do contrato — `DimensaoConformidade`
 * (`DimensaoConformidade.cs`) é `snake_case` (`taxa_inscricao`), não enum:
 * `taxa_inscricao` → "taxa inscricao". É transformação mecânica de grafia —
 * troca de separador e capitalização —, não um mapa código→rótulo escrito no
 * frontend: a exceção do §4 do plano é sobre vocabulário de NEGÓCIO, e aqui
 * não há tabela de tradução nenhuma, só a mesma palavra que o servidor já
 * mandou, sem `_`.
 */
export function rotuloDaDimensao(dimensao: string): string {
  const comEspacos = dimensao.replace(/_/g, ' ').trim();
  return comEspacos.charAt(0).toUpperCase() + comEspacos.slice(1);
}

/**
 * O passo do wizard dono de cada dimensão estrutural — `DimensaoConformidade`
 * é um conjunto FECHADO de oito valores (`DimensaoConformidade.cs`), e a
 * navegação da Parte A usa esta identidade estável, nunca o texto da
 * mensagem (CA-04).
 *
 * `exigencias_documentais` e `coleta_de_fatos` ficam de fora de propósito: são
 * as duas dimensões que a Feature já marca como fora do núcleo desta frente
 * (`#483`/`#484`, plano §3) — nenhum passo do wizard as grava ainda. Uma
 * pendência nelas mostra o grupo normalmente, sem um "Ir para" que levaria a
 * lugar nenhum.
 */
const PASSO_POR_DIMENSAO: Readonly<Record<string, number>> = {
  taxa_inscricao: 2,
  distribuicao_vagas: 3,
  // A cascata é seção do próprio passo Vagas (#481, plano §7) — não um passo à parte.
  cascata_remanejamento: 3,
  cronograma: 4,
  contagem_de_prazos: 4,
  // A classificação inteira — regra de cálculo, precisão e eliminação — é gravada
  // no persistir() do passo Eliminação (#482, plano §7, decisão registrada ali).
  classificacao: 9,
  // Locais de prova saiu do wizard (#511) — Atendimento herdou o índice 10.
  atendimento_especializado: 10,
};

export function passoDaDimensao(dimensao: string): number | null {
  return PASSO_POR_DIMENSAO[dimensao] ?? null;
}

/** Recusas nomeadas que nenhum dos dois checklists cobre (`#486`, Parte A, bloco 3). */
const CODIGOS_DE_DOCUMENTO_OU_ATO = new Set<string>([
  'ProcessoSeletivo.DocumentoNaoEncontrado',
  'ProcessoSeletivo.DocumentoNaoConfirmado',
  'ProcessoSeletivo.TipoDeAtoNaoEncontrado',
  'ProcessoSeletivo.TipoDeAtoNaoVigente',
  'ProcessoSeletivo.VagaDeLinhagemIndisponivel',
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
    if (instanteDoCampo(publicacao.periodoInscricaoInicio) === null) {
      mensagens.push(
        'Informe o início do período de inscrição — o cronograma não tem fase que colete inscrição pelo sistema.',
      );
    }
    if (instanteDoCampo(publicacao.periodoInscricaoFim) === null) {
      mensagens.push(
        'Informe o fim do período de inscrição — o cronograma não tem fase que colete inscrição pelo sistema.',
      );
    }
  }

  if (!publicacao.ato.orgao.trim()) mensagens.push('Informe o órgão do ato de publicação.');
  if (!publicacao.ato.serie.trim()) mensagens.push('Informe a série do ato de publicação.');
  if (inteiro(publicacao.ato.ano) === null) mensagens.push('Informe o ano do ato de publicação.');
  if (!publicacao.ato.dataPublicacao.trim())
    mensagens.push('Informe a data de publicação do ato.');
  if (!publicacao.ato.assinante.trim()) mensagens.push('Informe quem assina o ato.');
  if (!publicacao.ato.tipoAtoCodigo.trim()) mensagens.push('Selecione o tipo do ato.');

  return mensagens;
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
