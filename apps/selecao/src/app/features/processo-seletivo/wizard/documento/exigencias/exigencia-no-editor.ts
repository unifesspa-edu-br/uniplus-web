import type {
  DocumentoDaConfiguracaoExigencia,
  DocumentoDaConfiguracaoRegraDeComprovacao,
} from '@uniplus/shared-data/selecao';

import type { ExigenciaDeDocumento, RegraDeComprovacao } from '../../modelos/exigencias.models';
import { condicoesNoEditor } from './condicoes-da-exigencia';
import {
  baseLegalNoEditor,
  faseCodigoDaChave,
  formatosNoEditor,
  modeloNoEditor,
  prazoNoEditor,
  validadeNoEditor,
  type Fases,
} from './criterios-do-comprovante';

type Exigencia = DocumentoDaConfiguracaoExigencia;
type Regra = DocumentoDaConfiguracaoRegraDeComprovacao;

export type CamposDaRegraNoEditor = Omit<
  RegraDeComprovacao,
  'identificadorNoRascunho' | 'origem' | 'documento' | 'itens'
>;

/**
 * A exigência do documento como o editor a tem. O tipo de documento é identificado pelo código,
 * que o documento guarda no lugar de um identificador de cadastro.
 */
export function exigenciaNoEditor(exigencia: Exigencia, fases: Fases): ExigenciaDeDocumento {
  return {
    ...identidadeNoEditor(exigencia, fases),
    ...regraDaExigenciaNoEditor(exigencia),
    ...criteriosNoEditor(exigencia, fases),
  };
}

function identidadeNoEditor(exigencia: Exigencia, fases: Fases) {
  const codigo = exigencia.tipoDocumentoCodigo ?? '';
  return {
    chave: exigencia.chave,
    tipoDocumentoId: codigo,
    tipoDocumentoCodigo: codigo,
    tipoDocumentoNome: exigencia.tipoDocumentoNome,
    faseCodigo: faseCodigoDaChave(fases, exigencia.faseChave) ?? '',
    fatosComprovados: exigencia.dadosComprovados ?? [],
    etapaChave: exigencia.etapaChave ?? null,
    formularioCodigo: exigencia.formularioCodigo ?? null,
  };
}

function regraDaExigenciaNoEditor(exigencia: Exigencia) {
  return {
    aplicabilidade: exigencia.aplicabilidade ?? '',
    obrigatorio: exigencia.obrigatorio,
    consequenciaIndeferimento: exigencia.consequenciaDoDescumprimento ?? '',
    abrePrazoParaReenvio: exigencia.abrePrazoParaReenvio,
    condicoes: condicoesNoEditor(exigencia.condicoes),
    basesLegais: (exigencia.basesLegais ?? []).map(baseLegalNoEditor),
  };
}

function criteriosNoEditor(exigencia: Exigencia, fases: Fases) {
  return {
    prazoDeEmissao: prazoNoEditor(exigencia.prazoDeEmissao, fases),
    validade: validadeNoEditor(exigencia.validade, fases),
    formatosPermitidos: formatosNoEditor(exigencia.formatosPermitidos),
    tamanhoMaximoBytes: exigencia.tamanhoMaximoBytes ?? null,
    modelo: modeloNoEditor(exigencia),
  };
}

/** Os campos próprios da regra, sem a exigência que ela cita nem os itens do grupo. */
export function camposDaRegraNoEditor(regra: Regra): CamposDaRegraNoEditor {
  return {
    forma: regra.forma as RegraDeComprovacao['forma'],
    quantidadeMinima: regra.quantidadeMinima ?? null,
    consequencia: regra.consequenciaDoDescumprimento ?? null,
    abrePrazoParaReenvio: regra.abrePrazoParaReenvio ?? false,
    basesLegais: regra.basesLegais?.length ? regra.basesLegais.map(baseLegalNoEditor) : null,
    criterioDeDistincao: regra.criterioDeDistincao ?? null,
    dataReferencia: regra.dataReferencia ?? null,
    ocorrenciasEsperadas: regra.ocorrenciasEsperadas ?? null,
    grupoDoFormularioParaRepeticao: regra.grupoDoFormularioParaRepeticao ?? null,
  };
}

export function exigenciasPorChave(
  exigencias: readonly Exigencia[],
): ReadonlyMap<string, Exigencia> {
  const porChave = new Map<string, Exigencia>();
  for (const exigencia of exigencias) {
    if (!porChave.has(exigencia.chave)) porChave.set(exigencia.chave, exigencia);
  }
  return porChave;
}

/**
 * A tela só edita a regra de documento cuja exigência existe: a que cita uma exigência ausente
 * fica no documento como está, para a API apontá-la no diagnóstico.
 */
export function regraEditavel(regra: Regra, exigencias: ReadonlyMap<string, Exigencia>): boolean {
  if ((regra.forma as string) !== 'DOCUMENTO') return true;
  return regra.exigenciaChave !== undefined && exigencias.has(regra.exigenciaChave);
}

/**
 * Todas as regras do documento em uma única ordem, a de cada regra seguida pelos itens dela. A
 * posição de uma regra nesta lista é a `origem` que a tela guarda, e vale em qualquer grupo.
 */
export function regrasEmOrdem(regras: readonly Regra[]): Regra[] {
  return regras.flatMap((regra) => [regra, ...regrasEmOrdem(regra.itens ?? [])]);
}
