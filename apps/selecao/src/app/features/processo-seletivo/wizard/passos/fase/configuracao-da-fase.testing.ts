import {
  PARAMETROS_COM_INSTANCIA_SUPERIOR,
  umaLeituraDoRecurso,
} from '../../shared/configuracao-do-recurso/parametros-do-recurso.testing';
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
  ...PARAMETROS_COM_INSTANCIA_SUPERIOR,
  atoAncoraCodigo: 'RESULTADO_PRELIMINAR',
  leitura: umaLeituraDoRecurso(),
  procedimentos: [],
};

export function recurso(parcial: Partial<RecursoDaFase> = {}): RecursoDaFase {
  return { ...RECURSO_PADRAO, ...parcial };
}

export const nomeDaBanca = (id: string): string =>
  id === 'banca-hetero' ? 'Heteroidentificação' : id;

export function conferir(alvo: FaseDoCronograma) {
  return problemasDaFase(alvo, CATALOGO, nomeDaBanca);
}

export function campos(alvo: FaseDoCronograma) {
  return conferir(alvo).map((problema) => problema.campo);
}
