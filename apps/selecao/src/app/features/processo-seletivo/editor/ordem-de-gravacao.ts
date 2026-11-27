import type { ConducaoDoWizard } from './conducao-do-wizard.service';

/**
 * Os passos anteriores à Revisão na ordem em que a varredura da publicação os grava: a ordem da
 * tela, exceto que o passo que grava os critérios depois da classificação vem logo antes do
 * primeiro passo que grava a classificação. O servidor confere a classificação contra os critérios
 * que já tem, e gravá-la antes recusaria o rascunho por um critério que o próprio rascunho troca.
 */
export function ordemDeGravacao(conducao: ConducaoDoWizard): number[] {
  const ordemDaTela = Array.from({ length: conducao.store.totalDePassos - 1 }, (_, i) => i);
  const dosCriterios = conducao.indiceDoPassoPosClassificacao();
  const primeiroDaClassificacao = ordemDaTela.find(
    (indice) => conducao.passoNo(indice)?.gravaAClassificacao,
  );
  if (primeiroDaClassificacao === undefined || dosCriterios < primeiroDaClassificacao) {
    return ordemDaTela;
  }

  const ordem = ordemDaTela.filter((indice) => indice !== dosCriterios);
  ordem.splice(ordem.indexOf(primeiroDaClassificacao), 0, dosCriterios);
  return ordem;
}
