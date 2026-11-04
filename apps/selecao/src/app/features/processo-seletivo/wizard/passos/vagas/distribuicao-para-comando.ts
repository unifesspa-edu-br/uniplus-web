import { ConfiguracaoDistribuicaoVagasInput } from '@uniplus/shared-data/selecao';

import { DistribuicaoDeVagas } from '../../processo-seletivo.models';

/**
 * Converte o rascunho no comando que o servidor recebe.
 *
 * Os números viajam como número, e não como o texto que o campo edita: a
 * conversão acontece aqui, uma vez, com gramática explícita — `Number` cru
 * leria `1.000` como 1, o mesmo defeito corrigido no valor da taxa.
 *
 * Só as modalidades entram por id; o código que o rascunho guarda serve às
 * outras dimensões do edital, não ao comando.
 */
export function comoComando(distribuicao: DistribuicaoDeVagas): ConfiguracaoDistribuicaoVagasInput {
  return {
    ofertaCursoId: distribuicao.ofertaCursoId,
    voBase: inteiro(distribuicao.voBase),
    pr: decimal(distribuicao.pr),
    regraDistribuicaoCodigo: distribuicao.regraDistribuicaoCodigo,
    regraDistribuicaoVersao: distribuicao.regraDistribuicaoVersao,
    regraAjusteCodigo: distribuicao.regraAjusteCodigo,
    regraAjusteVersao: distribuicao.regraAjusteVersao,
    referenciaReservaDemograficaId: distribuicao.referenciaReservaDemograficaId,
    modalidadeIds: distribuicao.modalidades.map((modalidade) => modalidade.id),
    quadro: distribuicao.quadro.map((item) => ({
      modalidadeId: item.modalidadeId,
      quantidade: inteiro(item.quantidade),
    })),
  };
}

/** Só dígitos: `1e2` e `0x10` não são quantidades. */
function inteiro(texto: string): number {
  const limpo = texto.trim();
  return /^\d+$/.test(limpo) ? Number(limpo) : 0;
}

/** Vírgula ou ponto como separador decimal, sem notação exótica. */
function decimal(texto: string): number {
  const limpo = texto.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(limpo) ? Number(limpo) : 0;
}
