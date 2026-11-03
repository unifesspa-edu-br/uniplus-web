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
  return arvoreDeExigencias(rascunhoDado, FASES, modalidades, ETAPAS_VIVAS, FINALIDADES_POR_FASE);
}
