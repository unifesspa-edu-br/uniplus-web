import { CaraterEtapa } from '@uniplus/shared-data/selecao';

import type { EtapaPontuada, RecursoDaEtapa } from '../processo-seletivo.models';

const RECURSO_DA_ETAPA_PADRAO: RecursoDaEtapa = {
  ancora: 'atoPublicado',
  regraCodigo: 'REGRA_DO_RECURSO',
  regraVersao: '1',
  prazoValor: '3',
  prazoUnidade: 'diasUteis',
  atoAncoraCodigo: 'RESULTADO_PRELIMINAR',
  suspensividadePrimeiraInstanciaValor: '',
  suspensividadePrimeiraInstanciaUnidade: '',
  admiteInstanciaSuperior: false,
  suspensividadeSegundaInstanciaValor: '',
  suspensividadeSegundaInstanciaUnidade: '',
  procedimentos: [],
};

const ETAPA_DO_CRONOGRAMA_PADRAO: EtapaPontuada = {
  id: null,
  nome: 'Prova',
  carater: CaraterEtapa.ambas,
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
