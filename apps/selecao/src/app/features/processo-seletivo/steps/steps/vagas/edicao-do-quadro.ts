import { DistribuicaoDeVagas } from '../../processo-seletivo.models';
import { ehRamoFederal, quantidadeEhDeclarada } from './composicao-de-vagas';
import { ModalidadeDoCatalogo } from './modalidades-da-distribuicao';
import { PadraoDoEdital } from './padrao-do-edital';

type CatalogoDeModalidades = ReadonlyMap<string, ModalidadeDoCatalogo>;

/**
 * Tira do quadro o que o novo padrão não admite: modalidade que saiu da seleção, e quantidade de
 * modalidade que a regra passou a calcular.
 */
export function quadroCoerente(
  quadro: DistribuicaoDeVagas['quadro'],
  padrao: PadraoDoEdital,
  catalogo: CatalogoDeModalidades,
): DistribuicaoDeVagas['quadro'] {
  const selecionadas = new Set(padrao.modalidades.map((modalidade) => modalidade.id));
  const federal = ehRamoFederal(padrao.regraDistribuicaoCodigo);

  return quadro.filter((item) => {
    if (!selecionadas.has(item.modalidadeId)) return false;
    if (!federal) return true;

    const composicao = catalogo.get(item.modalidadeId)?.composicaoVagas;
    return composicao !== undefined && quantidadeEhDeclarada(composicao, federal);
  });
}

/**
 * O padrão é o da coleção: alterá-lo reescreve todas as ofertas, senão o que a tela mostra deixaria
 * de descrever o que será gravado.
 */
export function comPadraoAplicado(
  ofertas: readonly DistribuicaoDeVagas[],
  padrao: PadraoDoEdital,
  catalogo: CatalogoDeModalidades,
): DistribuicaoDeVagas[] {
  return ofertas.map((oferta) => ({
    ...oferta,
    ...padrao,
    quadro: quadroCoerente(oferta.quadro, padrao, catalogo),
  }));
}

export function comVoBase(
  ofertas: readonly DistribuicaoDeVagas[],
  ofertaCursoId: string,
  voBase: string,
): DistribuicaoDeVagas[] {
  return ofertas.map((item) => (item.ofertaCursoId === ofertaCursoId ? { ...item, voBase } : item));
}

export function comQuantidade(
  ofertas: readonly DistribuicaoDeVagas[],
  alvo: { readonly ofertaCursoId: string; readonly modalidadeId: string },
  valor: string,
): DistribuicaoDeVagas[] {
  return ofertas.map((oferta) => {
    if (oferta.ofertaCursoId !== alvo.ofertaCursoId) return oferta;

    const restante = oferta.quadro.filter((item) => item.modalidadeId !== alvo.modalidadeId);
    const quantidade = { modalidadeId: alvo.modalidadeId, quantidade: valor };
    return { ...oferta, quadro: valor.trim() === '' ? restante : [...restante, quantidade] };
  });
}

/** As ofertas marcadas entram no quadro com o padrão em tela, sem total nem quantidades. */
export function comOfertasAdicionadas(
  ofertas: readonly DistribuicaoDeVagas[],
  padrao: PadraoDoEdital,
  idsDasNovas: readonly string[],
): DistribuicaoDeVagas[] {
  return [
    ...ofertas,
    ...idsDasNovas.map((ofertaCursoId) => ({ ...padrao, ofertaCursoId, voBase: '', quadro: [] })),
  ];
}
