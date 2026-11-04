import { DistribuicaoDeVagas } from '../../processo-seletivo.models';

import { consomeOTotalDeVagas, ehRamoFederal } from './composicao-de-vagas';
import { ModalidadeDoCatalogo } from './modalidades-da-distribuicao';

/** O total de vagas da oferta é um inteiro positivo, sem zeros à esquerda. */
export function voBaseValido(voBase: string): boolean {
  return /^[1-9]\d*$/.test(voBase.trim());
}

/**
 * Soma das quantidades que o edital fixou e que saem do total da oferta.
 *
 * O que a regra calcula não entra: no ramo federal o quadro só guarda as
 * declaradas, e o resto vem da simulação. Quantidade malformada conta como
 * zero — a forma é recusada em outro lugar, e somá-la como `NaN` esconderia o
 * excesso real das outras.
 */
export function totalFixadoDoVo(
  distribuicao: DistribuicaoDeVagas,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
): number {
  const federal = ehRamoFederal(distribuicao.regraDistribuicaoCodigo);

  return distribuicao.quadro.reduce((soma, item) => {
    const composicao = catalogo.get(item.modalidadeId)?.composicaoVagas;
    if (composicao === undefined || !consomeOTotalDeVagas(composicao, federal)) return soma;

    const quantidade = Number(item.quantidade.trim());
    return soma + (Number.isInteger(quantidade) && quantidade > 0 ? quantidade : 0);
  }, 0);
}

/**
 * O que o edital fixa não pode ultrapassar o total de vagas da oferta: as
 * quantidades declaradas dividem esse total, não o ampliam.
 *
 * Total malformado devolve `null` — a forma já é recusada em outro lugar, e
 * comparar contra ela produziria uma segunda mensagem sobre o mesmo campo.
 */
export function problemaDeSomaDoQuadro(
  distribuicao: DistribuicaoDeVagas,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
): string | null {
  if (!voBaseValido(distribuicao.voBase)) return null;

  const total = Number(distribuicao.voBase.trim());
  const fixado = totalFixadoDoVo(distribuicao, catalogo);

  return fixado > total
    ? `As quantidades fixadas somam ${fixado} e passam do total de ${total} vagas da oferta.`
    : null;
}

/**
 * Confronta o total de vagas do processo com o que o ato de autorização
 * concede à oferta.
 *
 * É regra do cadastro, não da Lei de Cotas: por isso vive fora de
 * `problemasDaDistribuicao`, que trata das invariantes da própria
 * distribuição. Oferta sem vagas autorizadas registradas não impõe teto — a
 * ausência do dado não é permissão nem proibição.
 *
 * Total malformado devolve `null`: a forma já é recusada em outro lugar, e
 * empilhar duas mensagens sobre o mesmo campo não ajuda quem preenche.
 */
export function problemaDeVagasAutorizadas(
  voBase: string,
  vagasAutorizadas: number | null,
): string | null {
  if (vagasAutorizadas === null || !voBaseValido(voBase)) return null;

  const total = Number(voBase.trim());
  return total > vagasAutorizadas
    ? `O total de vagas (${total}) passa das ${vagasAutorizadas} autorizadas para a oferta.`
    : null;
}
