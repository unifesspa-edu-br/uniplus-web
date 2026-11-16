import { UnidadePrazo } from '@uniplus/shared-data/selecao';

import type { FaseDoCronograma, RecursoDaFase } from '../../processo-seletivo.models';
import { problemasDaFase, type AtoDoCatalogo } from './configuracao-da-fase';

export const CATALOGO: ReadonlyMap<string, AtoDoCatalogo> = new Map([
  ['RESULTADO_PRELIMINAR', { nome: 'Resultado preliminar', ehResultado: true }],
  ['GABARITO_PRELIMINAR', { nome: 'Gabarito preliminar', ehResultado: true }],
  ['RESULTADO_FINAL', { nome: 'Resultado final', ehResultado: true }],
  ['COMUNICADO', { nome: 'Comunicado', ehResultado: false }],
]);

export { umaFaseDoCronograma as fase } from '../../shared/fase-do-cronograma.testing';

const RECURSO_PADRAO: RecursoDaFase = {
  regraCodigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
  regraVersao: 'v1',
  prazoValor: '2',
  prazoUnidade: UnidadePrazo.diasUteis,
  atoAncoraCodigo: 'RESULTADO_PRELIMINAR',
  suspensividadePrimeiraInstanciaValor: '',
  suspensividadePrimeiraInstanciaUnidade: '',
  admiteInstanciaSuperior: true,
  suspensividadeSegundaInstanciaValor: '',
  suspensividadeSegundaInstanciaUnidade: '',
  procedimentos: [],
};

export function recurso(parcial: Partial<RecursoDaFase> = {}): RecursoDaFase {
  return { ...RECURSO_PADRAO, ...parcial };
}

export const nomeDaBanca = (id: string): string =>
  id === 'banca-hetero' ? 'Heteroidentificação' : id;

export function conferir(alvo: FaseDoCronograma, outras: readonly FaseDoCronograma[] = []) {
  return problemasDaFase(alvo, [alvo, ...outras], CATALOGO, nomeDaBanca);
}

export function campos(alvo: FaseDoCronograma, outras: readonly FaseDoCronograma[] = []) {
  return conferir(alvo, outras).map((problema) => problema.campo);
}
