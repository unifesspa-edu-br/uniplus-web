import type { ItemDocumentoExigidoInput, NoExigenciaInput } from '@uniplus/shared-data/selecao';
import { baseLegalParaEnvio, basesLegaisParaEnvio } from '@uniplus/shared-utils';

import type {
  ExigenciaDeDocumento,
  CriteriosDoComprovante,
  ExigenciasDoRascunho,
  NoDeExigencia,
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
 * Serializa a árvore do rascunho no que o `PUT` recebe, resolvendo o que é declarado por
 * código e descartando exigências de fases removidas e grupos que ficaram vazios.
 *
 * O `PUT` recusa a árvore inteira se um nó apontar fase que saiu do
 * cronograma (`FaseNaoPertenceAoProcesso`), etapa que não é da fase (`EtapaNaoPertenceAFase`),
 * cláusula de modalidade esvaziada (`ClausulaVazia`) ou grupo sem filhos (`GrupoVazio`) — e a
 * recusa chegaria sobre configuração que a tela não mostra mais.
 */
export function arvoreDeExigencias(
  exigencias: ExigenciasDoRascunho,
  processo: ProcessoVivoDasExigencias,
): readonly NoExigenciaInput[] {
  const completas = comAlcanceDeTodasAsFases(exigencias, [...processo.faseIdPorCodigo.keys()]);
  return completas.raizes.flatMap((raiz) =>
    prepararExigenciasParaEnvio([raiz], processo, finalidadeDaRaiz(raiz, processo)),
  );
}

/**
 * O formulário da árvore de raiz, declarado na primeira exigência de uma fase ativa e herdado por
 * todas as outras: o servidor recusa grupo com documentos de formulários diferentes.
 */
function finalidadeDaRaiz(raiz: NoDeExigencia, processo: ProcessoVivoDasExigencias): string | null {
  const declarante = documentosDe([raiz]).find((documento) =>
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
  nos: readonly NoDeExigencia[],
  processo: ProcessoVivoDasExigencias,
  finalidade: string | null,
): NoExigenciaInput[] {
  return nos.flatMap((no) => {
    if (no.tipo === 'FOLHA') return documentoDaExigenciaParaEnvio(no, processo, finalidade);
    const filhos = prepararExigenciasParaEnvio(no.filhos ?? [], processo, finalidade);
    if (filhos.length === 0) return [];
    return [{ ...dadosDaExigenciaParaEnvio(no), filhos }];
  });
}

/** Exclui exigências de fases removidas do cronograma. */
function documentoDaExigenciaParaEnvio(
  no: NoDeExigencia,
  processo: ProcessoVivoDasExigencias,
  finalidade: string | null,
): NoExigenciaInput[] {
  const documento = no.documento;
  if (documento === null || !processo.faseIdPorCodigo.has(documento.faseCodigo)) return [];
  return [
    {
      ...dadosDaExigenciaParaEnvio(no),
      documento: prepararDocumentoParaEnvio(documento, processo, finalidade),
    },
  ];
}

/** Os campos do nó que o rascunho carrega sem tocar, inclusive os que a tela não edita. */
function dadosDaExigenciaParaEnvio(no: NoDeExigencia): NoExigenciaInput {
  return {
    tipo: no.tipo,
    documento: null,
    quantidadeMinima: no.quantidadeMinima ?? null,
    consequencia: no.consequencia,
    basesLegais: no.basesLegais === null ? null : no.basesLegais.map(baseLegalParaEnvio),
    filhos: null,
    chaveDistincao: no.chaveDistincao,
    dataReferencia: no.dataReferencia,
    ocorrenciasEsperadas: no.ocorrenciasEsperadas,
    repetePorEntidade: no.repetePorEntidade,
  };
}

function prepararDocumentoParaEnvio(
  documento: ExigenciaDeDocumento,
  processo: ProcessoVivoDasExigencias,
  finalidade: string | null,
): ItemDocumentoExigidoInput {
  return {
    exigidoNaFaseId: processo.faseIdPorCodigo.get(documento.faseCodigo) ?? '',
    exigidoNaEtapaId: etapaDeColetaValida(documento, processo.etapasVivas),
    finalidade,
    tipoDocumentoId: documento.tipoDocumentoId,
    ...regraDaExigenciaParaEnvio(documento, processo.modalidadesOfertadas),
    ...criteriosDoComprovanteParaEnvio(documento, processo.faseIdPorCodigo),
  };
}

type RegraDaExigenciaParaEnvio = Pick<
  ItemDocumentoExigidoInput,
  'aplicabilidade' | 'obrigatorio' | 'consequenciaIndeferimento' | 'condicoes' | 'basesLegais'
>;

/** A aplicabilidade é declarada. Uma exigência geral segue sem condições (ADR-0071). */
function regraDaExigenciaParaEnvio(
  documento: ExigenciaDeDocumento,
  modalidadesOfertadas: readonly string[],
): RegraDaExigenciaParaEnvio {
  return {
    aplicabilidade: documento.aplicabilidade,
    obrigatorio: documento.obrigatorio,
    consequenciaIndeferimento:
      documento.consequenciaIndeferimento === '' ? null : documento.consequenciaIndeferimento,
    condicoes: condicoesParaEnvio(documento, modalidadesOfertadas),
    basesLegais: basesLegaisParaEnvio(documento.basesLegais),
  };
}

function condicoesParaEnvio(
  documento: ExigenciaDeDocumento,
  modalidadesOfertadas: readonly string[],
) {
  if (documento.aplicabilidade === APLICABILIDADE_GERAL) return [];
  const recorte = recorteDeModalidades(documento, modalidadesOfertadas);
  return comRecorteDeModalidade(documento.condicoes, recorte);
}

function criteriosDoComprovanteParaEnvio(
  documento: CriteriosDoComprovante,
  faseIdPorCodigo: ReadonlyMap<string, string>,
) {
  return {
    idadeMaximaEmissao: idadeMaximaParaEnvio(documento.idadeMaximaEmissao, faseIdPorCodigo),
    formatosPermitidos:
      documento.formatosPermitidos as ItemDocumentoExigidoInput['formatosPermitidos'],
    tamanhoMaximoBytes: documento.tamanhoMaximoBytes,
    modeloId: documento.modelo?.modeloId ?? null,
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
): ItemDocumentoExigidoInput['idadeMaximaEmissao'] {
  if (idade === null) return null;
  const { referenciaFaseCodigo, valor, unidade, referenciaTipo, data } = idade;
  const referenciaFaseId =
    referenciaFaseCodigo === null ? null : faseIdPorCodigo.get(referenciaFaseCodigo);
  if (referenciaFaseId === undefined) return null;
  return { valor, unidade, referenciaTipo, data, referenciaFaseId };
}
