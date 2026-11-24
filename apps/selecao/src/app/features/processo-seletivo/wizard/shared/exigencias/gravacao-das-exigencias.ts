import {
  OperadorCodigo,
  AplicabilidadeCodigo,
  FinalidadeFormularioCodigo,
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

import { prazoEValidadeParaEnvio } from './prazo-e-validade';
import { formatosParaEnvio } from './formatos-aceitos';
import { comAlcanceDeTodasAsFases } from './alcance-das-exigencias';
import { documentosDe } from './consulta-das-exigencias';
import { APLICABILIDADE_GERAL } from './exigencias-documentais';
import { finalidadeEnviada } from './formulario-da-exigencia';
import { comRestricaoDeModalidades, modalidadesParaGravacao } from './modalidades-da-exigencia';

/** Os dados do processo usados para preparar as exigências para envio. */
export interface ProcessoVivoDasExigencias {
  readonly faseIdPorCodigo: ReadonlyMap<string, string>;
  readonly modalidadesOfertadas: readonly string[];
  readonly etapasVivas: ReadonlySet<string>;
  readonly finalidadesPorFase: ReadonlyMap<string, readonly string[]>;
}

export interface OrigemDaRegraEnviada {
  readonly identificadorDaRegra: string;
  readonly faseCodigo?: string;
  readonly itens: readonly OrigemDaRegraEnviada[];
}

export interface ExigenciasParaEnvio {
  readonly regras: readonly RegraDeComprovacaoInformada[];
  readonly origens: readonly OrigemDaRegraEnviada[];
}

export function regrasDeComprovacaoParaEnvio(
  exigencias: ExigenciasDoRascunho,
  processo: ProcessoVivoDasExigencias,
): ExigenciasParaEnvio {
  const completas = comAlcanceDeTodasAsFases(exigencias, [...processo.faseIdPorCodigo.keys()]);
  const preparadas = completas.regrasDeComprovacao.flatMap((regra) =>
    prepararExigenciasParaEnvio([regra], processo, finalidadeDaRegra(regra, processo)),
  );
  return {
    regras: preparadas.map((item) => item.regra),
    origens: origensParaApresentacao(preparadas, completas, exigencias),
  };
}

function origensParaApresentacao(
  preparadas: readonly RegraPreparada[],
  completas: ExigenciasDoRascunho,
  exigencias: ExigenciasDoRascunho,
): OrigemDaRegraEnviada[] {
  const existentes = new Set(
    exigencias.regrasDeComprovacao.map((regra) => regra.identificadorNoRascunho),
  );
  return preparadas.map((item) => origemDaRegra(item.origem, completas, existentes));
}

function origemDaRegra(
  origem: OrigemDaRegraEnviada,
  completas: ExigenciasDoRascunho,
  existentes: ReadonlySet<string>,
): OrigemDaRegraEnviada {
  const regra = completas.regrasDeComprovacao.find(
    (item) => item.identificadorNoRascunho === origem.identificadorDaRegra,
  );
  if (!regra || existentes.has(regra.identificadorNoRascunho) || !regra.documento) return origem;
  return {
    ...origem,
    identificadorDaRegra: regra.documento.tipoDocumentoId,
    faseCodigo: regra.documento.faseCodigo,
  };
}

interface RegraPreparada {
  readonly regra: RegraDeComprovacaoInformada;
  readonly origem: OrigemDaRegraEnviada;
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
): RegraPreparada[] {
  return regras.flatMap((regra) => {
    if (regra.forma === 'DOCUMENTO')
      return documentoDaExigenciaParaEnvio(regra, processo, finalidade);
    const itens = prepararExigenciasParaEnvio(regra.itens ?? [], processo, finalidade);
    if ((regra.itens?.length ?? 0) > 0 && itens.length === 0) return [];
    return [grupoPreparado(regra, itens)];
  });
}

function grupoPreparado(
  regra: RegraDeComprovacao,
  itens: readonly RegraPreparada[],
): RegraPreparada {
  return {
    regra: { ...dadosDaExigenciaParaEnvio(regra), itens: itens.map((item) => item.regra) },
    origem: {
      identificadorDaRegra: regra.identificadorNoRascunho,
      itens: itens.map((item) => item.origem),
    },
  };
}

function documentoDaExigenciaParaEnvio(
  regra: RegraDeComprovacao,
  processo: ProcessoVivoDasExigencias,
  finalidade: string | null,
): RegraPreparada[] {
  const documento = regra.documento;
  if (documento === null) return [];
  if (!documento.faseIdLido && !processo.faseIdPorCodigo.has(documento.faseCodigo)) return [];
  return [documentoPreparado(regra, prepararDocumentoParaEnvio(documento, processo, finalidade))];
}

function documentoPreparado(
  regra: RegraDeComprovacao,
  documento: ItemDocumentoExigidoInput,
): RegraPreparada {
  return {
    regra: { ...dadosDaExigenciaParaEnvio(regra), documento },
    origem: { identificadorDaRegra: regra.identificadorNoRascunho, itens: [] },
  };
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
    fatosComprovados: documento.fatosComprovados ?? [],
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
    tipo: codigoDoContrato(AplicabilidadeCodigo, documento.aplicabilidade),
    condicoes: condicoesParaEnvio(documento, modalidadesOfertadas),
  };
}

function momentoParaEnvio(
  documento: ExigenciaDeDocumento,
  processo: ProcessoVivoDasExigencias,
  finalidade: string | null,
): ItemDocumentoExigidoInput['momento'] {
  return {
    faseId: processo.faseIdPorCodigo.get(documento.faseCodigo) ?? documento.faseIdLido ?? '',
    etapaId: documento.faseIdLido
      ? documento.etapaId
      : etapaDeColetaValida(documento, processo.etapasVivas),
    finalidade: finalidadeParaEnvio(documento, finalidade),
  };
}

function finalidadeParaEnvio(documento: ExigenciaDeDocumento, finalidade: string | null) {
  return codigoDoContrato(
    FinalidadeFormularioCodigo,
    (documento.faseIdLido ? documento.finalidade : finalidade) ?? '',
  );
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
  const modalidadesRestritas = modalidadesParaGravacao(documento, modalidadesOfertadas);
  return comRestricaoDeModalidades(documento.condicoes, modalidadesRestritas).map(
    condicaoParaEnvio,
  );
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
    ...prazoEValidadeParaEnvio(documento, faseIdPorCodigo),
    formatosPermitidos: formatosParaEnvio(documento.formatosPermitidos),
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
