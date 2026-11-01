import { nomeDaOferta, type CertamePublicadoDto } from '@uniplus/shared-data/selecao';

/** Texto de quem tem a oferta na inscrição mas não a encontra no certame publicado. */
export const OFERTA_NAO_IDENTIFICADA = 'Curso não identificado';

/** O nome de cada oferta do certame pelo id da oferta de origem. */
export function nomesDasOfertas(certame: CertamePublicadoDto): ReadonlyMap<string, string> {
  return new Map(
    certame.ofertas.map((oferta) => [oferta.ofertaCursoOrigemId, nomeDaOferta(oferta)]),
  );
}
