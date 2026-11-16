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
  const federal = ehRamoFederal(padrao.ramoDaDistribuicao);

  return quadro.filter(
    (item) =>
      selecionadas.has(item.modalidadeId) &&
      (!federal || quantidadeDeclaradaNoRamoFederal(catalogo, item.modalidadeId)),
  );
}

function quantidadeDeclaradaNoRamoFederal(
  catalogo: CatalogoDeModalidades,
  modalidadeId: string,
): boolean {
  const composicao = catalogo.get(modalidadeId)?.composicaoVagas;
  return composicao !== undefined && quantidadeEhDeclarada(composicao, true);
}

/**
 * O padrão é o da coleção: alterá-lo reescreve todas as ofertas, senão o que a tela mostra deixaria
 * de descrever o que será gravado. O ajuste do quadro não é do padrão: cada oferta o traz do
 * contrato e o devolve, porque a gravação substitui a distribuição inteira.
 */
export function comPadraoAplicado(
  ofertas: readonly DistribuicaoDeVagas[],
  padrao: PadraoDoEdital,
  catalogo: CatalogoDeModalidades,
): DistribuicaoDeVagas[] {
  return ofertas.map((oferta) => ({
    ...oferta,
    ...padrao,
    ajusteDoQuadro: ajusteAposOPadrao(oferta, padrao),
    quadro: quadroCoerente(oferta.quadro, padrao, catalogo),
  }));
}

/**
 * O ajuste do quadro pertence à regra de distribuição da oferta: trocar a regra o zera, e na Lei de
 * Cotas o servidor o recusa, porque ela reconcilia pela regra de ajuste. Qualquer outra edição do
 * padrão deixa o ajuste de cada oferta como está.
 */
function ajusteAposOPadrao(
  oferta: DistribuicaoDeVagas,
  padrao: PadraoDoEdital,
): DistribuicaoDeVagas['ajusteDoQuadro'] {
  const mesmaRegra =
    oferta.regraDistribuicaoCodigo === padrao.regraDistribuicaoCodigo &&
    oferta.regraDistribuicaoVersao === padrao.regraDistribuicaoVersao;

  return mesmaRegra && !ehRamoFederal(padrao.ramoDaDistribuicao) ? oferta.ajusteDoQuadro : null;
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

/** As ofertas marcadas entram no quadro com o padrão em tela, sem total, quantidades nem ajuste. */
export function comOfertasAdicionadas(
  ofertas: readonly DistribuicaoDeVagas[],
  padrao: PadraoDoEdital,
  idsDasNovas: readonly string[],
): DistribuicaoDeVagas[] {
  return [...ofertas, ...idsDasNovas.map((ofertaCursoId) => ofertaNova(ofertaCursoId, padrao))];
}

function ofertaNova(ofertaCursoId: string, padrao: PadraoDoEdital): DistribuicaoDeVagas {
  return { ...padrao, ofertaCursoId, voBase: '', ajusteDoQuadro: null, quadro: [] };
}
