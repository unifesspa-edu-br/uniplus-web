import type { FatoCandidatoView, FatoDoCatalogoDto } from './fatos-candidato.api';

/** O fato do catálogo com os operadores que a condição admite sobre ele, na ordem de oferta. */
export type FatoCandidatoComOperadores = FatoCandidatoView &
  Pick<FatoDoCatalogoDto, 'operadoresAdmitidos'>;

/** Desfaz o envelope da leitura pública do catálogo: os operadores passam a fazer parte do fato. */
export function fatoComOperadores({
  fato,
  operadoresAdmitidos,
}: FatoDoCatalogoDto): FatoCandidatoComOperadores {
  return { ...fato, operadoresAdmitidos };
}
