import { ProblemDetails } from '@uniplus/shared-core/http';

/**
 * Recusas nomeadas de documento e de ato que nenhum dos dois checklists cobre. São os códigos do
 * wire (`uniplus.<modulo>.<razao>`), que é o que `problem.code` carrega.
 */
const CODIGOS_DE_DOCUMENTO_OU_ATO = new Set<string>([
  'uniplus.selecao.processo_seletivo.documento_nao_encontrado',
  'uniplus.selecao.processo_seletivo.documento_nao_confirmado',
  'uniplus.selecao.processo_seletivo.documento_do_edital_nao_e_pdf',
  'uniplus.selecao.processo_seletivo.tipo_de_ato_sem_versao_vigente',
  'uniplus.selecao.processo_seletivo.tipo_de_ato_nao_congela_configuracao',
  'uniplus.selecao.processo_seletivo.objeto_ja_tem_ato_vivo_do_tipo',
  'uniplus.selecao.anexo_do_edital.nao_encontrado',
  'uniplus.selecao.anexo_do_edital.nao_confirmado',
  'uniplus.selecao.anexo_do_edital.repetido',
  'uniplus.selecao.anexo_do_edital.finalidade_incompativel',
  'uniplus.selecao.anexo_do_edital.nome_invalido',
  'uniplus.selecao.anexo_do_edital.quantidade_excedida',
]);

/**
 * Recusas da conformidade legal que não são falha de carga: o servidor entendeu o pedido e
 * respondeu que ainda não há como avaliar, porque o rascunho não tem de onde derivar a data de
 * referência. São as mesmas que o gate de publicação emitiria, e por isso a tela as repete como
 * pendência a resolver, em vez de pedir "tente novamente".
 */
const CODIGOS_DE_CONFORMIDADE_LEGAL_NAO_AVALIAVEL = new Set<string>([
  'uniplus.selecao.processo_seletivo.inscricao_propria_sem_fase_de_coleta',
  'uniplus.selecao.processo_seletivo.fase_que_coleta_inscricao_sem_janela',
  'uniplus.selecao.processo_seletivo.periodo_inscricao_obrigatorio_sem_fase_de_coleta',
]);

/** Uma pendência estrutural, como a extensão `pendencias` do 422 a devolve: um item reprovado, sem o `ok`. */
export interface PendenciaEstruturalProblem {
  readonly codigo: string;
  readonly dimensao: string;
  readonly mensagem: string;
}

/** Uma obrigatoriedade legal reprovada, como a extensão `obrigatoriedadesReprovadas` do 422 a devolve. */
export interface ObrigatoriedadeReprovadaProblem {
  readonly regraCodigo: string;
  readonly descricaoHumana: string;
  readonly baseLegal: string;
  readonly motivo: string | null;
  /**
   * Onde a norma pode ser lida, e desde quando ela vige. Só existem quando a reprovação vem da
   * consulta de conformidade legal: a extensão do 422 carrega os quatro campos acima e mais nada.
   */
  readonly atoNormativoUrl?: string | null;
  readonly portariaInterna?: string | null;
  readonly vigenciaInicio?: string | null;
}

/**
 * `ProblemDetails` com as duas extensões que só a publicação emite. Não entra no tipo
 * compartilhado de `shared-core` porque são de um endpoint só.
 */
export interface ProblemComExtensoesDePublicacao extends ProblemDetails {
  readonly pendencias?: readonly PendenciaEstruturalProblem[];
  readonly obrigatoriedadesReprovadas?: readonly ObrigatoriedadeReprovadaProblem[];
}

export function eErroDeDocumentoOuAto(codigo: string): boolean {
  return CODIGOS_DE_DOCUMENTO_OU_ATO.has(codigo);
}

/** A recusa de publicar ou retificar com fase do cronograma sem unidade responsável. */
export function eErroDeFaseSemUnidade(codigo: string): boolean {
  return codigo === 'uniplus.selecao.processo_seletivo.fase_sem_unidade_responsavel';
}

/**
 * O motivo pelo qual a conformidade legal não pôde ser avaliada, ou `null` quando a resposta não é
 * uma dessas pendências e portanto é falha de carga.
 */
export function motivoDeConformidadeLegalNaoAvaliavel(problem: ProblemDetails): string | null {
  if (!CODIGOS_DE_CONFORMIDADE_LEGAL_NAO_AVALIAVEL.has(problem.code)) return null;
  return problem.detail?.trim() || problem.title;
}

export function comExtensoesDePublicacao(problem: ProblemDetails): ProblemComExtensoesDePublicacao {
  return problem as ProblemComExtensoesDePublicacao;
}
