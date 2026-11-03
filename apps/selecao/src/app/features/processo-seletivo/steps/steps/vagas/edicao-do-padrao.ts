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
 * federal o servidor recusa regra de ajuste e referência demográfica, então saem.
 */
export function padraoAposTrocarDeRegra(
  padrao: PadraoDoEdital,
  troca: {
    readonly codigo: string;
    readonly versao: string;
    readonly rol: readonly string[] | null;
    readonly catalogo: readonly ModalidadeSelecionada[];
  },
): Partial<PadraoDoEdital> {
  const modalidades =
    troca.rol === null ? padrao.modalidades : modalidadesDoRolAtual(troca.rol, troca.catalogo);
  const regra = { regraDistribuicaoCodigo: troca.codigo, regraDistribuicaoVersao: troca.versao };

  return ehRamoFederal(troca.codigo)
    ? { ...regra, modalidades }
    : {
        ...regra,
        regraAjusteCodigo: null,
        regraAjusteVersao: null,
        referenciaReservaDemograficaId: null,
        modalidades,
      };
}
