import { TURNOS_OFERTA } from '@uniplus/shared-data/configuracao';
import type { components } from './schema';

/** Uma oferta de curso como a publicação do certame a congelou. */
export type OfertaDeCursoCertameDto = components['schemas']['OfertaDeCursoCertameDto'];

const ROTULO_DO_TURNO = new Map(TURNOS_OFERTA.map((t) => [t.value, t.label]));

/** O nome da oferta como foi congelado na publicação: curso e grau, unidade e turnos. */
export function nomeDaOferta(oferta: OfertaDeCursoCertameDto): string {
  return [
    `${oferta.cursoNome} (${oferta.cursoGrau})`,
    oferta.unidadeOfertanteNome,
    oferta.turnos.map((t) => ROTULO_DO_TURNO.get(t) ?? t).join(' e '),
  ].join(' — ');
}
