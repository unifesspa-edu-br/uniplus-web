import { TURNOS_OFERTA } from '@uniplus/shared-data/configuracao';
import type { InscricaoDto } from '@uniplus/shared-data/selecao';

type OfertaPublicada = InscricaoDto['ofertas'][number];

/** Uma oferta de curso que o candidato escolhe na inscrição, com o nome congelado na publicação. */
export interface OfertaDaInscricao {
  readonly id: string;
  readonly nome: string;
}

const ROTULO_DO_TURNO = new Map(TURNOS_OFERTA.map((t) => [t.value, t.label]));

/** O nome da oferta como foi congelado na publicação: curso e grau, unidade e turnos. */
export function nomeDaOferta(oferta: OfertaPublicada): string {
  return [
    `${oferta.cursoNome} (${oferta.cursoGrau})`,
    oferta.unidadeOfertanteNome,
    oferta.turnos.map((t) => ROTULO_DO_TURNO.get(t) ?? t).join(' e '),
  ].join(' — ');
}

/**
 * As ofertas que a inscrição oferece: as da versão em que ela está, não as do certame ao vivo.
 * Em ordem alfabética, porque a API as devolve na ordem do identificador.
 */
export function ofertasDaInscricao(
  inscricao: Pick<InscricaoDto, 'ofertas'>,
): readonly OfertaDaInscricao[] {
  return inscricao.ofertas
    .map((o) => ({ id: o.ofertaCursoOrigemId, nome: nomeDaOferta(o) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Quantas opções de curso a versão da inscrição admite, do número que a API devolve: uma ou duas. */
export function numeroDeOpcoesDeCurso(numero: number | string): 1 | 2 {
  return Number(numero) >= 2 ? 2 : 1;
}
