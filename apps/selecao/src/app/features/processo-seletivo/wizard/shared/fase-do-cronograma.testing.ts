import type { FaseDoCronograma } from '../processo-seletivo.models';

const FASE_DO_CRONOGRAMA_PADRAO: FaseDoCronograma = {
  faseCanonicaId: 'id-1',
  codigo: 'AVALIACAO',
  ordem: 1,
  inicio: null,
  fim: null,
  unidadeResponsavelId: null,
  produtos: [],
  noMesmoMomentoDaAnterior: false,
  emiteParecerIndividual: false,
  bancasRequeridas: [],
  regraRecurso: null,
  tiposDeDecisao: [],
  regraDeHomologacao: null,
  congelados: null,
};

/** Uma fase do cronograma sem nada declarado; o teste sobrescreve só o que está medindo. */
export function umaFaseDoCronograma(parcial: Partial<FaseDoCronograma> = {}): FaseDoCronograma {
  return { ...FASE_DO_CRONOGRAMA_PADRAO, ...parcial };
}
