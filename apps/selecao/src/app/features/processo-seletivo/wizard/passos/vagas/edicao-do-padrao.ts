import { DistribuicaoDeVagas } from '../../processo-seletivo.models';
import { ehRamoFederal } from './composicao-de-vagas';
import { comPadraoAplicado } from './edicao-do-quadro';
import { ModalidadeDoCatalogo, modalidadesDoRol } from './modalidades-da-distribuicao';
import { PadraoDoEdital } from './padrao-do-edital';

export type ModalidadeSelecionada = { readonly id: string; readonly codigo: string };

/** O que a conta de perda no quadro precisa saber do catálogo e das ofertas em tela. */
export interface ContextoDoRol {
  readonly modalidadesPorId: ReadonlyMap<string, ModalidadeDoCatalogo>;
  readonly ofertas: readonly DistribuicaoDeVagas[];
}

/** O rol fechado da regra como seleção, ou nada quando o rol é aberto. */
export function modalidadesDoRolAtual(
  rol: readonly string[] | null,
  catalogo: readonly ModalidadeSelecionada[],
): ModalidadeSelecionada[] {
  if (rol === null) return [];

  return modalidadesDoRol(catalogo, rol).map((m) => ({ id: m.id, codigo: m.codigo }));
}

/**
 * Se aplicar `modalidades` faria o quadro descartar alguma quantidade já preenchida: não só a de
 * modalidade que sai da seleção, também a de modalidade que fica mas passa a ter composição
 * calculada pela regra. Delega para a regra real em vez de reimplementar o filtro.
 */
export function perderiaQuantidadeDoQuadro(
  padrao: PadraoDoEdital,
  modalidades: readonly ModalidadeSelecionada[],
  contexto: ContextoDoRol,
): boolean {
  const aplicado = comPadraoAplicado(
    contexto.ofertas,
    { ...padrao, modalidades },
    contexto.modalidadesPorId,
  );
  return aplicado.some(
    (oferta, indice) => oferta.quadro.length < contexto.ofertas[indice].quadro.length,
  );
}

/**
 * Trocar a regra define o rol: rol aberto preserva a seleção livre; rol fechado é a oferta
 * inteira, porque a regra determina o conjunto e não filtra uma escolha dentro dele. Fora do ramo
 * federal o servidor recusa regra de ajuste e referência demográfica, e o percentual da reserva
 * legal não se aplica, então saem.
 */
export function padraoAposTrocarDeRegra(
  padrao: PadraoDoEdital,
  troca: TrocaDeRegra,
): Partial<PadraoDoEdital> {
  const regra = {
    regraDistribuicaoCodigo: troca.codigo,
    regraDistribuicaoVersao: troca.versao,
    ramoDaDistribuicao: troca.ramo,
    modalidades: modalidadesAposTroca(padrao, troca),
  };

  return ehRamoFederal(troca.ramo) ? regra : { ...regra, ...SEM_ITENS_FEDERAIS };
}

function modalidadesAposTroca(
  padrao: PadraoDoEdital,
  troca: TrocaDeRegra,
): PadraoDoEdital['modalidades'] {
  if (troca.rol === null) return padrao.modalidades;
  return modalidadesDoRolAtual(troca.rol, troca.catalogo);
}

/** O que só existe sob a Lei 12.711 e sai do padrão quando a regra escolhida é de outro ramo. */
const SEM_ITENS_FEDERAIS = {
  pr: '',
  regraAjusteCodigo: null,
  regraAjusteVersao: null,
  referenciaReservaDemograficaId: null,
};

export interface TrocaDeRegra {
  readonly codigo: string;
  readonly versao: string;
  readonly ramo: string | null;
  readonly rol: readonly string[] | null;
  readonly catalogo: readonly ModalidadeSelecionada[];
}
