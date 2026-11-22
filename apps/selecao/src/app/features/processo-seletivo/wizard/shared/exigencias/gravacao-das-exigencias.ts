import {
  OperadorCodigo,
  FormaDeComprovacaoCodigo,
  type ItemDocumentoExigidoInput,
  type RegraDeComprovacaoInformada,
} from '@uniplus/shared-data/selecao';
import { codigoDoContrato } from '@uniplus/shared-data/utils';
import { baseLegalParaEnvio, basesLegaisParaEnvio } from '@uniplus/shared-utils';

import type {
  CondicaoGatilhoConfig,
  ExigenciaDeDocumento,
  CriteriosDoComprovante,
  ExigenciasDoRascunho,
  RegraDeComprovacao,
} from '../../processo-seletivo.models';

import { comAlcanceDeTodasAsFases } from './alcance-das-exigencias';
import { documentosDe } from './consulta-das-exigencias';
import { APLICABILIDADE_GERAL } from './exigencias-documentais';
import { finalidadeEnviada } from './formulario-da-exigencia';
import { comRecorteDeModalidade, recorteDeModalidades } from './recorte-por-modalidade';

/** Os dados do processo usados para preparar as exigências para envio. */
export interface ProcessoVivoDasExigencias {
  readonly faseIdPorCodigo: ReadonlyMap<string, string>;
  readonly modalidadesOfertadas: readonly string[];
  readonly etapasVivas: ReadonlySet<string>;
  readonly finalidadesPorFase: ReadonlyMap<string, readonly string[]>;
}

/**
 * Serializa a estrutura de regras do rascunho no que o `PUT` recebe, resolvendo o que é declarado por
 * código e descartando exigências de fases removidas e grupos que ficaram vazios.
 *
 * O `PUT` recusa a estrutura de regras inteira se uma regra apontar fase que saiu do
 * cronograma (`FaseNaoPertenceAoProcesso`), etapa que não é da fase (`EtapaNaoPertenceAFase`),
 * cláusula de modalidade esvaziada (`ClausulaVazia`) ou grupo sem itens (`GrupoVazio`) — e a
 * recusa chegaria sobre configuração que a tela não mostra mais.
 */
export function regrasDeComprovacaoParaEnvio(
  exigencias: ExigenciasDoRascunho,
  processo: ProcessoVivoDasExigencias,
): readonly RegraDeComprovacaoInformada[] {
  const completas = comAlcanceDeTodasAsFases(exigencias, [...processo.faseIdPorCodigo.keys()]);
  return completas.regrasDeComprovacao.flatMap((regraPrincipal) =>
    prepararExigenciasParaEnvio(
      [regraPrincipal],
      processo,
      finalidadeDaRegra(regraPrincipal, processo),
    ),
  );
}

/**
 * O formulário da regra principal, declarado na primeira exigência de uma fase ativa e herdado por
 * todas as outras: o servidor recusa grupo com documentos de formulários diferentes.
 */
function finalidadeDaRegra(
  regraPrincipal: RegraDeComprovacao,
  processo: ProcessoVivoDasExigencias,
): string | null {
  const declarante = documentosDe([regraPrincipal]).find((documento) =>
    processo.faseIdPorCodigo.has(documento.faseCodigo),
  );
  return declarante === undefined
    ? null
    : finalidadeEnviada(
        declarante.finalidade,
        processo.finalidadesPorFase.get(declarante.faseCodigo) ?? [],
      );
}

function prepararExigenciasParaEnvio(
  regras: readonly RegraDeComprovacao[],
  processo: ProcessoVivoDasExigencias,
  finalidade: string | null,
): RegraDeComprovacaoInformada[] {
  return regras.flatMap((regra) => {
    if (regra.forma === 'DOCUMENTO')
      return documentoDaExigenciaParaEnvio(regra, processo, finalidade);
    const itensDoGrupo = prepararExigenciasParaEnvio(regra.itens ?? [], processo, finalidade);
    if (itensDoGrupo.length === 0) return [];
    return [{ ...dadosDaExigenciaParaEnvio(regra), itens: itensDoGrupo }];
  });
}

/** Exclui exigências de fases removidas do cronograma. */
function documentoDaExigenciaParaEnvio(
  regra: RegraDeComprovacao,
  processo: ProcessoVivoDasExigencias,
  finalidade: string | null,
): RegraDeComprovacaoInformada[] {
  const documento = regra.documento;
  if (documento === null || !processo.faseIdPorCodigo.has(documento.faseCodigo)) return [];
  return [
    {
      ...dadosDaExigenciaParaEnvio(regra),
      documento: prepararDocumentoParaEnvio(documento, processo, finalidade),
    },
  ];
}

/** Os campos da regra que o rascunho carrega sem tocar, inclusive os que a tela não edita. */
function dadosDaExigenciaParaEnvio(regra: RegraDeComprovacao): RegraDeComprovacaoInformada {
  return {
    forma: codigoDoContrato(FormaDeComprovacaoCodigo, regra.forma),
    documento: null,
    cardinalidade: cardinalidadeParaEnvio(regra),
    indeferimento: indeferimentoDoGrupoParaEnvio(regra),
    itens: null,
    grupoDoFormularioParaRepeticao: regra.grupoDoFormularioParaRepeticao,
  };
}

function cardinalidadeParaEnvio(
  regra: RegraDeComprovacao,
): RegraDeComprovacaoInformada['cardinalidade'] {
  const { quantidadeMinima, criterioDeDistincao, dataReferencia, ocorrenciasEsperadas } = regra;
  const semDistincao =
    criterioDeDistincao === null && dataReferencia === null && ocorrenciasEsperadas === null;
  if (quantidadeMinima === null && semDistincao) return null;
  return {
    quantidadeMinima,
    distincao: semDistincao ? null : { criterioDeDistincao, dataReferencia, ocorrenciasEsperadas },
  };
}

function indeferimentoDoGrupoParaEnvio(
  regra: RegraDeComprovacao,
): RegraDeComprovacaoInformada['indeferimento'] {
  if (regra.consequencia === null && regra.basesLegais === null) return null;
  return {
    consequencia: regra.consequencia,
    basesLegais: regra.basesLegais === null ? null : regra.basesLegais.map(baseLegalParaEnvio),
  };
}

function prepararDocumentoParaEnvio(
  documento: ExigenciaDeDocumento,
  processo: ProcessoVivoDasExigencias,
  finalidade: string | null,
): ItemDocumentoExigidoInput {
  return {
    tipoDocumento: { id: documento.tipoDocumentoId },
    momento: momentoParaEnvio(documento, processo, finalidade),
    aplicabilidade: aplicabilidadeParaEnvio(documento, processo.modalidadesOfertadas),
    indeferimento: indeferimentoDoDocumentoParaEnvio(documento),
    requisitos: requisitosParaEnvio(documento, processo.faseIdPorCodigo),
  };
}

function aplicabilidadeParaEnvio(
  documento: ExigenciaDeDocumento,
  modalidadesOfertadas: readonly string[],
): ItemDocumentoExigidoInput['aplicabilidade'] {
  return {
    tipo: documento.aplicabilidade,
    condicoes: condicoesParaEnvio(documento, modalidadesOfertadas),
  };
}

function momentoParaEnvio(
  documento: ExigenciaDeDocumento,
  processo: ProcessoVivoDasExigencias,
  finalidade: string | null,
): ItemDocumentoExigidoInput['momento'] {
  return {
    faseId: processo.faseIdPorCodigo.get(documento.faseCodigo) ?? '',
    etapaId: etapaDeColetaValida(documento, processo.etapasVivas),
    finalidade,
  };
}

function indeferimentoDoDocumentoParaEnvio(
  documento: ExigenciaDeDocumento,
): ItemDocumentoExigidoInput['indeferimento'] {
  return {
    obrigatorio: documento.obrigatorio,
    consequencia:
      documento.consequenciaIndeferimento === '' ? null : documento.consequenciaIndeferimento,
    basesLegais: basesLegaisParaEnvio(documento.basesLegais),
  };
}

/** Uma exigência geral segue sem condições (ADR-0071). */
function condicoesParaEnvio(
  documento: ExigenciaDeDocumento,
  modalidadesOfertadas: readonly string[],
): CondicoesDaAplicabilidade {
  if (documento.aplicabilidade === APLICABILIDADE_GERAL) return [];
  const recorte = recorteDeModalidades(documento, modalidadesOfertadas);
  return comRecorteDeModalidade(documento.condicoes, recorte).map(condicaoParaEnvio);
}

type CondicoesDaAplicabilidade = NonNullable<
  NonNullable<ItemDocumentoExigidoInput['aplicabilidade']>['condicoes']
>;

function condicaoParaEnvio(condicao: CondicaoGatilhoConfig): CondicoesDaAplicabilidade[number] {
  return { ...condicao, operador: codigoDoContrato(OperadorCodigo, condicao.operador) };
}

function requisitosParaEnvio(
  documento: CriteriosDoComprovante,
  faseIdPorCodigo: ReadonlyMap<string, string>,
): ItemDocumentoExigidoInput['requisitos'] {
  return {
    idadeMaximaEmissao: idadeMaximaParaEnvio(documento.idadeMaximaEmissao, faseIdPorCodigo),
    formatosPermitidos: documento.formatosPermitidos,
    tamanhoMaximoBytes: documento.tamanhoMaximoBytes,
    modelo: documento.modelo === null ? null : { modeloId: documento.modelo.modeloId },
  };
}

/**
 * A etapa que coletava saiu do cronograma: o documento volta a ser da fase inteira em vez de
 * referenciar um identificador que o processo não tem mais.
 */
function etapaDeColetaValida(
  documento: ExigenciaDeDocumento,
  etapasVivas: ReadonlySet<string>,
): string | null {
  const etapaId = documento.etapaId;
  return etapaId !== null && etapaId !== '' && etapasVivas.has(etapaId) ? etapaId : null;
}

/**
 * A idade máxima, com a fase âncora resolvida de volta para identificador.
 *
 * A fase que ancorava saiu do cronograma: a âncora é limpa em vez de viajar apontando para
 * linha que não existe mais. O servidor recusaria com `IdadeMaximaEmissao.FaseNaoPertenceAoProcesso`,
 * e a recusa falaria de um campo que esta tela não renderiza — o operador não teria o que fazer.
 */
function idadeMaximaParaEnvio(
  idade: ExigenciaDeDocumento['idadeMaximaEmissao'],
  faseIdPorCodigo: ReadonlyMap<string, string>,
): NonNullable<ItemDocumentoExigidoInput['requisitos']>['idadeMaximaEmissao'] {
  if (idade === null) return null;
  const { referenciaFaseCodigo, valor, unidade, referenciaTipo, data } = idade;
  const referenciaFaseId =
    referenciaFaseCodigo === null ? null : faseIdPorCodigo.get(referenciaFaseCodigo);
  if (referenciaFaseId === undefined) return null;
  return { valor, unidade, referenciaTipo, data, referenciaFaseId };
}
