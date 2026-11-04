import { DistribuicaoDeVagas, ModalidadeDaOferta } from '../../processo-seletivo.models';

/** O que o edital declara uma vez e vale para todas as ofertas do quadro. */
export interface PadraoDoEdital {
  readonly regraDistribuicaoCodigo: string;
  readonly regraDistribuicaoVersao: string;
  readonly regraAjusteCodigo: string | null;
  readonly regraAjusteVersao: string | null;
  readonly referenciaReservaDemograficaId: string | null;
  readonly modalidades: readonly ModalidadeDaOferta[];
  readonly pr: string;
}

/**
 * A oferta segue o padrão que a tela apresenta.
 *
 * O contrato guarda regra, percentual e referência por oferta, então um
 * processo gravado por outro caminho pode trazer ofertas divergentes. A tela
 * mostra o padrão da primeira e enviaria os valores de cada uma: sem comparar,
 * o operador confirmaria um quadro e gravaria outro.
 */
export function seguemOMesmoPadrao(
  distribuicao: DistribuicaoDeVagas,
  padrao: PadraoDoEdital,
): boolean {
  return (
    distribuicao.regraDistribuicaoCodigo === padrao.regraDistribuicaoCodigo &&
    distribuicao.regraDistribuicaoVersao === padrao.regraDistribuicaoVersao &&
    distribuicao.regraAjusteCodigo === padrao.regraAjusteCodigo &&
    distribuicao.regraAjusteVersao === padrao.regraAjusteVersao &&
    distribuicao.referenciaReservaDemograficaId === padrao.referenciaReservaDemograficaId &&
    distribuicao.pr === padrao.pr &&
    mesmasModalidades(distribuicao.modalidades, padrao.modalidades)
  );
}

function mesmasModalidades(
  daOferta: readonly ModalidadeDaOferta[],
  doPadrao: readonly ModalidadeDaOferta[],
): boolean {
  if (daOferta.length !== doPadrao.length) return false;

  const noPadrao = new Set(doPadrao.map((modalidade) => modalidade.id));
  return daOferta.every((modalidade) => noPadrao.has(modalidade.id));
}
