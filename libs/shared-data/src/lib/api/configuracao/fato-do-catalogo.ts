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

/** O catálogo como os editores de formulário o leem: o escopo do fato é o código. */
export function comEscopoPeloCodigo<T extends { readonly escopo?: { readonly codigo: string } }>(
  fatos: readonly T[],
): readonly (Omit<T, 'escopo'> & { readonly escopo: string })[] {
  return fatos.map((fato) => ({ ...fato, escopo: fato.escopo?.codigo ?? '' }));
}
