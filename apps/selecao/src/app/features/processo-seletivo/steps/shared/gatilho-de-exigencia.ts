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
 * Os fatos que o editor de gatilho oferece, na ordem do catálogo.
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
