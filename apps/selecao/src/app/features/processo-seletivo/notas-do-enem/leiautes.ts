import type { LeiauteDoInepDto, LeiauteEscolhido } from '@uniplus/shared-data/selecao';

/** O valor da opção no select: o par que identifica o leiaute no catálogo. */
export function chaveDoLeiaute(leiaute: Pick<LeiauteDoInepDto, 'codigo' | 'versao'>): string {
  return `${leiaute.codigo}|${leiaute.versao}`;
}

export function rotuloDoLeiaute(leiaute: Pick<LeiauteDoInepDto, 'descricao' | 'versao'>): string {
  return `${leiaute.descricao} (${leiaute.versao})`;
}

/** O leiaute que a chave escolhida designa no catálogo; nulo sem escolha ou com leiaute que saiu dele. */
export function leiauteDaChave(
  catalogo: readonly LeiauteDoInepDto[],
  chave: string,
): LeiauteEscolhido | null {
  const leiaute = catalogo.find((l) => chaveDoLeiaute(l) === chave);
  return leiaute === undefined
    ? null
    : { leiauteCodigo: leiaute.codigo, leiauteVersao: leiaute.versao };
}
