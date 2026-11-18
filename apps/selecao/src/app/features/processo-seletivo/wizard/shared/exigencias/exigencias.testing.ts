import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import { arvoreDeExigencias } from './gravacao-das-exigencias';
import { comExigencia, exigenciaNova } from './exigencias-documentais';
import type { ExigenciaDeDocumento, ExigenciasDoRascunho } from '../../processo-seletivo.models';

export const ID_ISENCAO = '01960000-0000-7000-0000-0000000000f1';
export const ID_HABILITACAO = '01960000-0000-7000-0000-0000000000f2';
export const ID_ETAPA_RENDA = '01960000-0000-7000-0000-0000000000e1';
export const ID_RG = '01960000-0000-7000-0000-0000000000d1';
export const ID_CONTRACHEQUE = '01960000-0000-7000-0000-0000000000d2';
export const ID_DIPLOMA = '01960000-0000-7000-0000-0000000000d3';

/** As etapas que o processo tem hoje — é contra elas que a exigência aponta. */
export const ETAPAS_VIVAS = new Set([ID_ETAPA_RENDA]);

export const FASES = new Map([
  ['ISENCAO', ID_ISENCAO],
  ['HABILITACAO', ID_HABILITACAO],
]);

/** A fase da isenção divide o formulário com a inscrição; a de habilitação responde só o dela. */
export const FINALIDADES_POR_FASE: ReadonlyMap<string, readonly string[]> = new Map([
  ['ISENCAO', ['INSCRICAO', 'ISENCAO_TAXA']],
  ['HABILITACAO', ['HABILITACAO']],
]);

/** O cadastro de tipos de documento, de onde saem formato aceito e tamanho máximo. */
export const RESTRICAO_RG = { formatosAceitos: 'PDF,JPEG,PNG', tamanhoMaximoMb: 5 };

export function exigencia(patch: Partial<ExigenciaDeDocumento> = {}): ExigenciaDeDocumento {
  return { ...exigenciaNova(ID_RG, 'HABILITACAO', RESTRICAO_RG), ...patch };
}

export function rascunho(...exigencias: readonly ExigenciaDeDocumento[]): ExigenciasDoRascunho {
  return exigencias.reduce<ExigenciasDoRascunho>(
    (acumulado, atual) => comExigencia(acumulado, atual),
    { raizes: [], emTodasAsFases: [] },
  );
}

export function comando(
  rascunhoDado: ExigenciasDoRascunho,
  modalidades: readonly string[] = ['AC'],
) {
  return arvoreDeExigencias(rascunhoDado, {
    faseIdPorCodigo: FASES,
    modalidadesOfertadas: modalidades,
    etapasVivas: ETAPAS_VIVAS,
    finalidadesPorFase: FINALIDADES_POR_FASE,
  });
}

export function detalheDaApi(raizes: readonly unknown[]): ProcessoSeletivoDto {
  return {
    cronogramaFases: [
      { id: ID_ISENCAO, codigo: 'ISENCAO' },
      { id: ID_HABILITACAO, codigo: 'HABILITACAO' },
    ],
    raizesExigencia: raizes,
  } as unknown as ProcessoSeletivoDto;
}

const RG_EXIGIDO_NA_HABILITACAO = {
  id: 'doc-1',
  exigidoNaFaseId: ID_HABILITACAO,
  tipoDocumentoOrigemId: ID_RG,
  aplicabilidade: 'GERAL',
  obrigatorio: true,
  consequenciaIndeferimento: null,
  idadeMaximaEmissao: null,
  formatosPermitidos: 'QUALQUER',
  tamanhoMaximoBytes: null,
  exigidoNaEtapaId: null,
  modelo: null,
};

export function exigenciaDaApi(alteracoes: Record<string, unknown> = {}) {
  return {
    id: 'no-1',
    tipo: 'FOLHA',
    quantidadeMinima: null,
    consequencia: null,
    basesLegais: [],
    filhos: [],
    chaveDistincao: null,
    dataReferencia: null,
    ocorrenciasEsperadas: null,
    repetePorEntidade: null,
    documento: { ...RG_EXIGIDO_NA_HABILITACAO, condicoes: [], basesLegais: [], ...alteracoes },
  };
}
