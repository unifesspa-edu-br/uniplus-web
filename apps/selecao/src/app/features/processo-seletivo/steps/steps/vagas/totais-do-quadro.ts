import { DistribuicaoDeVagas } from '../../processo-seletivo.models';
import { inteiroNaForma } from '../../shared/numero-do-campo';

/**
 * O que não é inteiro não entra na soma: célula vazia ou malformada já é apontada pela validação,
 * e somá-la como `NaN` apagaria o total inteiro.
 */
function inteiroOuZero(valor: string): number {
  return inteiroNaForma(valor) ?? 0;
}

/** A quantidade que o edital fixou para a modalidade nesta oferta, em texto, ou vazio. */
export function quantidadeDoQuadro(
  distribuicao: DistribuicaoDeVagas,
  modalidadeId: string,
): string {
  return distribuicao.quadro.find((item) => item.modalidadeId === modalidadeId)?.quantidade ?? '';
}

/** A soma das vagas que as ofertas declaram: a base sobre a qual a regra calcula. */
export function totalDeVagasInformadas(distribuicoes: readonly DistribuicaoDeVagas[]): number {
  return distribuicoes.reduce((soma, item) => soma + inteiroOuZero(item.voBase), 0);
}

/** Soma da coluna de uma modalidade que o edital declara. */
export function totalDeclaradoDe(
  distribuicoes: readonly DistribuicaoDeVagas[],
  modalidadeId: string,
): number {
  return distribuicoes.reduce(
    (soma, item) => soma + inteiroOuZero(quantidadeDoQuadro(item, modalidadeId)),
    0,
  );
}

/** Soma da coluna de uma modalidade que a regra calcula, a partir do texto que a tela mostra. */
export function totalCalculadoDe(
  distribuicoes: readonly DistribuicaoDeVagas[],
  modalidadeId: string,
  quantidadeCalculada: (distribuicao: DistribuicaoDeVagas, modalidadeId: string) => string,
): number {
  return distribuicoes.reduce(
    (soma, item) => soma + inteiroOuZero(quantidadeCalculada(item, modalidadeId)),
    0,
  );
}
