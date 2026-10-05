import type { FatoCandidatoView } from '@uniplus/shared-data/configuracao';
import {
  OPERADOR_DIFERENTE,
  OPERADOR_EM,
  OPERADOR_IGUAL,
  OPERADOR_NAO_EM,
  clausulasDe,
  comClausulaEm,
  comCondicaoEm,
  comCondicaoTrocadaEm,
  fatosEscolhiveis,
  problemasDeCondicoes,
  semClausulaEm,
  semCondicaoEm,
  valorEscalarDe,
  valoresDeListaDe,
  type ClausulaDeCondicoes,
  type CondicaoDeFato,
  type CondicaoPosicionada as CondicaoPosicionadaGenerica,
  type FatoEscolhivel,
} from '@uniplus/shared-ui/components';

import type { CondicaoGatilhoConfig, ExigenciaDeDocumento } from '../processo-seletivo.models';
import { FATO_MODALIDADE, exigidoDeTodos, numerosDeClausula } from './exigencias-documentais';
import {
  ehCampoDeMembro,
  oProcessoResolve,
  orientacaoDaRecusaDeFase,
  orientacaoDoCampoDeMembroForaDaRepeticao,
  recusaDeFaseDoGatilho,
  type FatoComFase,
  type LugarDaExigencia,
  type NomesDaOrientacao,
  type ProducaoDosFatos,
} from './fase-do-fato';

/**
 * O gatilho de uma exigência documental: a condição sobre fatos do candidato que diz de quem
 * o documento é cobrado.
 *
 * O título de eleitor não se cobra de estrangeiro, de mulher nem de menor de dezoito; a
 * quitação com o serviço militar só se cobra de homem maior de dezoito, e nem dele quando é
 * indígena. As regras de predicado — operadores por domínio, forma do valor, alcance,
 * conferência — são do editor compartilhado em `@uniplus/shared-ui`, reexportado daqui para
 * que o resto do módulo tenha um só lugar de onde importar. O que fica neste arquivo é o que
 * é DESTA exigência: o recorte por modalidade, que tem controle próprio, e o modelo do
 * documento.
 */
export {
  OPERADOR_DIFERENTE,
  OPERADOR_EM,
  OPERADOR_IGUAL,
  OPERADOR_MAIOR_IGUAL,
  OPERADOR_MENOR_IGUAL,
  OPERADOR_NAO_EM,
  RESPOSTAS_BOOLEANAS,
  VALOR_FALSO,
  VALOR_VERDADEIRO,
  alcanceDaCondicao,
  comOperador,
  comValorEscalar,
  comValoresDeLista,
  comparaComLista,
  condicaoNova,
  fatoEscolhivel,
  nomesDoCatalogo,
  operadoresDoFato,
  problemaDaCondicao,
  valorEscalarDe,
  valoresDeListaDe,
  type CondicaoDeFato,
  type FatoEscolhivel,
  type OperadorEscolhivel,
  type TipoDeDominio,
} from '@uniplus/shared-ui/components';

/** Uma condição junto com a posição que ela ocupa no gatilho — é por ela que a tela a edita. */
export type CondicaoPosicionada = CondicaoPosicionadaGenerica<CondicaoGatilhoConfig>;

/** Uma alternativa do gatilho: as condições que precisam valer JUNTAS para ela ser satisfeita. */
export type ClausulaDeGatilho = ClausulaDeCondicoes<CondicaoGatilhoConfig>;

/**
 * Os fatos que um gatilho sabe avaliar, na ordem do catálogo, sem o recorte de fase da
 * exigência — o vocabulário com que a tela lê e confere condições já escritas. O que o editor
 * de uma exigência oferece é `fatosDoGatilhoNaFase`.
 *
 * A modalidade fica de fora: ela tem controle próprio — "quem deve entregar" —, alimentado
 * pelo quadro de vagas, e oferecê-la duas vezes deixaria duas telas escrevendo a mesma
 * cláusula.
 */
export function fatosParaGatilho(
  fatos: readonly FatoCandidatoView[],
  dominiosDinamicos: ReadonlyMap<string, readonly string[]> = new Map(),
): readonly FatoEscolhivel[] {
  return fatosEscolhiveis(fatos, dominiosDinamicos, [FATO_MODALIDADE]);
}

/** A fonte dos valores do fato cujo domínio são as modalidades que o processo oferta. */
const FONTE_MODALIDADE = 'MODALIDADE';

/** O fato cujas opções são as condições de atendimento que o processo oferta. */
const FATO_CONDICAO_ATENDIMENTO = 'CONDICAO_ATENDIMENTO';

/**
 * Os valores que o processo oferta para os fatos de domínio dinâmico que o gatilho cita: as
 * condições de atendimento, e as modalidades para todo fato cujos valores são modalidades — a
 * modalidade da convocação inclusive. Decide pela fonte dos valores que o catálogo declara, como
 * o servidor ao conferir o gatilho, e não pelo código do fato.
 */
export function dominiosDoGatilho(
  fatos: readonly FatoCandidatoView[],
  condicoesDeAtendimento: readonly string[],
  modalidades: readonly string[],
): ReadonlyMap<string, readonly string[]> {
  return new Map([
    [FATO_CONDICAO_ATENDIMENTO, condicoesDeAtendimento],
    ...fatos
      .filter((fato) => fato.fonteValores === FONTE_MODALIDADE)
      .map((fato): [string, readonly string[]] => [fato.codigo, modalidades]),
  ]);
}

/** Como a opção nomeia o fato que a condição já cita e que esta exigência não pode citar. */
const MARCA_DO_FATO_NAO_CITAVEL = ' (não citável nesta exigência)';

/**
 * Os fatos que o gatilho de uma exigência oferece onde ela é cobrada: os que o processo resolve — de
 * qualquer formulário, derivados e produzidos pela classificação — e que já são conhecidos até a
 * fase da exigência, sem o que só o formulário de isenção coleta no documento de outro formulário. Os que a exigência já cita e deixaram de ser citáveis vêm depois, marcados,
 * para a condição gravada continuar visível com o motivo ao lado.
 *
 * O campo de membro de grupo repetível só entra quando o documento se repete pelo grupo que o
 * coleta (`camposDaRepeticao`): ele tem um valor por ocorrência, e fora dela não há de quem lê-lo.
 */
export function fatosDoGatilhoNaFase(
  fatos: readonly FatoComFase[],
  lugar: LugarDaExigencia,
  producao: ProducaoDosFatos,
  dominiosDinamicos: ReadonlyMap<string, readonly string[]>,
  citados: readonly string[] = [],
  camposDaRepeticao: ReadonlySet<string> = new Set(),
): readonly FatoEscolhivel[] {
  const citaveis = fatos.filter(
    (fato) =>
      (!ehCampoDeMembro(fato) || camposDaRepeticao.has(fato.codigo)) &&
      oProcessoResolve(fato, producao) &&
      recusaDeFaseDoGatilho(fato.codigo, lugar, producao) === null,
  );
  const naoCitaveis = fatos
    .filter((fato) => citados.includes(fato.codigo) && !citaveis.includes(fato))
    .map((fato) => ({ ...fato, nome: `${fato.nome}${MARCA_DO_FATO_NAO_CITAVEL}` }));
  return fatosEscolhiveis([...citaveis, ...naoCitaveis], dominiosDinamicos, [FATO_MODALIDADE]);
}

/** A recusa de fase de uma condição do gatilho, com a orientação de como resolvê-la. */
export interface RecusaDeFaseNaCondicao {
  /** A posição da condição em `condicoes`. */
  readonly indice: number;
  readonly orientacao: string;
}

/**
 * As condições do gatilho que citam fato ainda não conhecido na fase da exigência, ou campo de membro
 * de grupo repetível em documento que não se repete pelo grupo que o coleta.
 */
export function recusasDeFaseDoGatilho(
  documento: ExigenciaDeDocumento,
  producao: ProducaoDosFatos,
  nomes: NomesDaOrientacao,
  camposDaRepeticao: ReadonlySet<string> = new Set(),
): readonly RecusaDeFaseNaCondicao[] {
  return documento.condicoes.flatMap((condicao, indice) => {
    if (condicao.fato.trim() === '') return [];
    const doCatalogo = producao.catalogo.get(condicao.fato);
    if (doCatalogo !== undefined && ehCampoDeMembro(doCatalogo) && !camposDaRepeticao.has(condicao.fato)) {
      return [{ indice, orientacao: orientacaoDoCampoDeMembroForaDaRepeticao(condicao.fato, producao, nomes) }];
    }
    const recusa = recusaDeFaseDoGatilho(condicao.fato, documento, producao);
    return recusa === null
      ? []
      : [{ indice, orientacao: orientacaoDaRecusaDeFase(recusa, documento, producao, nomes) }];
  });
}

/**
 * As alternativas do gatilho, na ordem, sem a condição de modalidade — que a tela edita pelo
 * controle de "quem deve entregar" e mostraria aqui como uma segunda verdade sobre o mesmo
 * recorte.
 */
export function clausulasDoGatilho(documento: ExigenciaDeDocumento): readonly ClausulaDeGatilho[] {
  return clausulasDe(documento.condicoes, FATO_MODALIDADE);
}

/** A exigência com uma condição a mais na alternativa indicada. */
export function comCondicao(
  documento: ExigenciaDeDocumento,
  clausula: number,
  fato: FatoEscolhivel,
): ExigenciaDeDocumento {
  return { ...documento, condicoes: comCondicaoEm(documento.condicoes, clausula, fato) };
}

/** A exigência com UMA condição trocada, endereçada pela posição que a tela conhece. */
export function comCondicaoTrocada(
  documento: ExigenciaDeDocumento,
  indice: number,
  condicao: CondicaoGatilhoConfig,
): ExigenciaDeDocumento {
  return { ...documento, condicoes: comCondicaoTrocadaEm(documento.condicoes, indice, condicao) };
}

/** A exigência sem aquela condição; a alternativa que fica vazia some e as demais renumeram. */
export function semCondicao(
  documento: ExigenciaDeDocumento,
  indice: number,
): ExigenciaDeDocumento {
  return { ...documento, condicoes: semCondicaoEm(documento.condicoes, indice) };
}

/**
 * A exigência com uma alternativa a mais — a segunda via pela qual o documento passa a ser
 * cobrado, combinada por OU com as que já existem.
 *
 * O recorte de modalidade acompanha: ele vale para o gatilho inteiro, e deixá-lo de fora da
 * alternativa nova a faria valer para toda modalidade.
 */
export function comClausula(
  documento: ExigenciaDeDocumento,
  fato: FatoEscolhivel,
): ExigenciaDeDocumento {
  return { ...documento, condicoes: comClausulaEm(documento.condicoes, fato, FATO_MODALIDADE) };
}

/** A exigência sem aquela alternativa inteira. */
export function semClausula(
  documento: ExigenciaDeDocumento,
  numero: number,
): ExigenciaDeDocumento {
  return { ...documento, condicoes: semClausulaEm(documento.condicoes, numero) };
}

/**
 * O que impede o gatilho de ser gravado, espelhando o que o servidor confere: fato fora do
 * vocabulário, operador que o domínio não admite, e condição sem valor.
 *
 * O recorte por modalidade é conferido pelo seu próprio controle — "quem deve entregar" —,
 * contra o quadro de vagas, que este vocabulário não enxerga.
 */
export function problemasDoGatilho(
  documento: ExigenciaDeDocumento,
  fatosPorCodigo: ReadonlyMap<string, FatoEscolhivel>,
  nomeNoCatalogo: ReadonlyMap<string, string> = new Map(),
): readonly string[] {
  return problemasDeCondicoes(documento.condicoes, fatosPorCodigo, nomeNoCatalogo, [
    FATO_MODALIDADE,
  ]);
}

/**
 * As modalidades do recorte do gatilho, ou `null` quando ele não tem recorte uniforme.
 *
 * Recorte é a mesma cláusula `MODALIDADE EM [...]`, com a mesma lista, em TODAS as
 * alternativas — a forma que o controle "quem deve entregar" grava. Só então ela restringe o
 * gatilho inteiro; presente em algumas alternativas, é condição delas e de mais nenhuma.
 */
export function recorteUniforme(documento: ExigenciaDeDocumento): readonly string[] | null {
  if (documento.condicoes.length === 0) return null;

  const listasPorAlternativa = numerosDeClausula(documento.condicoes).map((numero) =>
    documento.condicoes
      .filter(
        (condicao) =>
          condicao.clausula === numero &&
          condicao.fato === FATO_MODALIDADE &&
          condicao.operador === OPERADOR_EM,
      )
      .map((condicao) => JSON.stringify(valoresDeListaDe(condicao))),
  );

  const [primeira] = listasPorAlternativa[0] ?? [];
  if (primeira === undefined) return null;
  const uniforme = listasPorAlternativa.every((listas) => listas.includes(primeira));
  return uniforme ? (JSON.parse(primeira) as string[]) : null;
}

/**
 * Se a exigência pode ser cobrada de quem concorre na modalidade — a mesma regra do domínio
 * (`DocumentoExigido.PodeAlcancarModalidade`). A de todo candidato alcança qualquer uma; a
 * condicional sem condição nenhuma, nenhuma. Nas demais, basta uma alternativa cujas condições
 * sobre modalidade aceitem o código: as sobre outros fatos não se sabem antes da inscrição, e
 * a alternativa sem condição de modalidade alcança qualquer uma.
 *
 * Vale para qualquer operador que o domínio aceita, não só o `EM` que o editor escreve: o
 * gatilho gravado por outro caminho continua sendo cobrado.
 */
export function podeAlcancarModalidade(
  documento: ExigenciaDeDocumento,
  modalidadeCodigo: string,
): boolean {
  if (exigidoDeTodos(documento)) return true;
  if (documento.condicoes.length === 0) return false;

  return numerosDeClausula(documento.condicoes).some((numero) =>
    documento.condicoes
      .filter((condicao) => condicao.clausula === numero && condicao.fato === FATO_MODALIDADE)
      .every((condicao) => condicaoDeModalidadeAceita(condicao, modalidadeCodigo)),
  );
}

function condicaoDeModalidadeAceita(condicao: CondicaoDeFato, modalidadeCodigo: string): boolean {
  switch (condicao.operador) {
    case OPERADOR_IGUAL:
      return valorEscalarDe(condicao) === modalidadeCodigo;
    case OPERADOR_DIFERENTE:
      return valorEscalarDe(condicao) !== modalidadeCodigo;
    case OPERADOR_EM:
      return valoresDeListaDe(condicao).includes(modalidadeCodigo);
    case OPERADOR_NAO_EM:
      return !valoresDeListaDe(condicao).includes(modalidadeCodigo);
    default:
      return false;
  }
}
