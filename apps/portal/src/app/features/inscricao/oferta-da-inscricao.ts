import { TURNOS_OFERTA } from '@uniplus/shared-data/configuracao';
import type { CertamePublicadoDto } from '@uniplus/shared-data/selecao';

type OfertaPublicada = CertamePublicadoDto['ofertas'][number];

const ROTULO_DO_TURNO = new Map(TURNOS_OFERTA.map((t) => [t.value, t.label]));

/** O nome da oferta como foi congelado na publicação: curso e grau, unidade e turnos. */
export function nomeDaOferta(oferta: OfertaPublicada): string {
  return [
    `${oferta.cursoNome} (${oferta.cursoGrau})`,
    oferta.unidadeOfertanteNome,
    oferta.turnos.map((t) => ROTULO_DO_TURNO.get(t) ?? t).join(' e '),
  ].join(' — ');
}
