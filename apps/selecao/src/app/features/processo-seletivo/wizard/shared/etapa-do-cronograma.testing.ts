import { CaraterEtapaCodigo } from '@uniplus/shared-data/selecao';

import type { EtapaPontuada, RecursoDaEtapa } from '../processo-seletivo.models';
import {
  PARAMETROS_SEM_INSTANCIA_SUPERIOR,
  umaLeituraDoRecurso,
} from './configuracao-do-recurso/parametros-do-recurso.testing';

const RECURSO_DA_ETAPA_PADRAO: RecursoDaEtapa = {
  ancora: 'PUBLICACAO_DO_ATO',
  regraCodigo: 'REGRA_DO_RECURSO',
  regraVersao: '1',
  ...PARAMETROS_SEM_INSTANCIA_SUPERIOR,
  prazoValor: '3',
  atoAncoraCodigo: 'RESULTADO_PRELIMINAR',
  leitura: umaLeituraDoRecurso(),
  procedimentos: [],
};

const ETAPA_DO_CRONOGRAMA_PADRAO: EtapaPontuada = {
  id: null,
  nome: 'Prova',
  carater: CaraterEtapaCodigo.AMBAS,
  tipoEtapaOrigemId: '',
  peso: '1',
  notaMinima: '',
  notaMaxima: '10',
  passoDoLancamento: '',
  formaDeAvaliacao: 'OBJETIVA',
  regraConsolidacaoCodigo: '',
  regraConsolidacaoVersao: '',
  itensDeAvaliacao: [],
  escalaDeAtendimento: [],
  ordem: 1,
  faseCodigo: 'AVALIACAO',
  produtos: [],
  inicio: '',
  fim: '',
  emiteParecerIndividual: false,
  bancas: [],
  recursos: [],
  tiposDeDecisao: [],
};

/** Um recurso de etapa completo; o teste sobrescreve só o que está medindo. */
export function umRecursoDaEtapa(parcial: Partial<RecursoDaEtapa> = {}): RecursoDaEtapa {
  return { ...RECURSO_DA_ETAPA_PADRAO, ...parcial };
}

/** Uma etapa do cronograma sem tipo de cadastro; o teste sobrescreve só o que está medindo. */
export function umaEtapaDoCronograma(parcial: Partial<EtapaPontuada> = {}): EtapaPontuada {
  return { ...ETAPA_DO_CRONOGRAMA_PADRAO, ...parcial };
}
