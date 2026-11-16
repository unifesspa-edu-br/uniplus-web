import type { RegraCatalogoDto } from '@uniplus/shared-data/selecao';

import type { ProcedimentoDeRecurso } from '../../../processo-seletivo.models';

export function regraDoCatalogo(codigo: string, baseLegal: string): RegraCatalogoDto {
  return {
    codigo,
    versao: 'v1',
    tipo: 'regra_procedimento_recurso',
    esquemaArgs: {},
    invariantes: {},
    baseLegal,
    modalidadesAdmitidas: null,
    ramoDaDistribuicao: null,
    hash: 'h'.repeat(64),
  };
}

export function procedimento(parcial: Partial<ProcedimentoDeRecurso> = {}): ProcedimentoDeRecurso {
  return {
    tipoDeDecisao: 'RESULTADO_PRELIMINAR',
    alvo: null,
    regraCodigo: 'PROCEDIMENTO-RECURSO-COLEGIADO',
    regraVersao: 'v1',
    sugestao: null,
    ...parcial,
  };
}
