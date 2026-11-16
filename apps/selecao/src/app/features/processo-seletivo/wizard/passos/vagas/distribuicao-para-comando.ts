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
    vagasOfertadasBase: inteiro(distribuicao.voBase),
    percentualDaReservaLegal: decimalOuNulo(distribuicao.pr),
    regraDistribuicaoCodigo: distribuicao.regraDistribuicaoCodigo,
    regraDistribuicaoVersao: distribuicao.regraDistribuicaoVersao,
    regraAjusteCodigo: distribuicao.regraAjusteCodigo,
    regraAjusteVersao: distribuicao.regraAjusteVersao,
    referenciaReservaDemograficaId: distribuicao.referenciaReservaDemograficaId,
    ajusteDoQuadro: distribuicao.ajusteDoQuadro,
    modalidadeIds: distribuicao.modalidades.map((modalidade) => modalidade.id),
    quadro: distribuicao.quadro.map(quantidadeDoComando),
  };
}

function quantidadeDoComando(item: DistribuicaoDeVagas['quadro'][number]): {
  modalidadeId: string;
  quantidade: number;
} {
  return { modalidadeId: item.modalidadeId, quantidade: inteiro(item.quantidade) };
}

/** Só dígitos: `1e2` e `0x10` não são quantidades. */
function inteiro(texto: string): number {
  const limpo = texto.trim();
  return /^\d+$/.test(limpo) ? Number(limpo) : 0;
}

/**
 * Vírgula ou ponto como separador decimal, sem notação exótica. Campo vazio é percentual que não
 * se aplica (quadro fixado no edital) e vai como ausente; texto que não é número vai como zero,
 * que o servidor recusa por estar fora do limite.
 */
function decimalOuNulo(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.');
  if (limpo === '') return null;
  return /^\d+(\.\d+)?$/.test(limpo) ? Number(limpo) : 0;
}
