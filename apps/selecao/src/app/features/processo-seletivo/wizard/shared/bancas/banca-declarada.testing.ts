import type { BancaDeclarada, BancaRequeridaDaFase } from '../../modelos/banca.models';

/** Uma banca da tela sem regra nem cópia do tipo; o teste sobrescreve só o que está medindo. */
export function umaBancaDeclarada(parcial: Partial<BancaDeclarada> = {}): BancaDeclarada {
  return {
    id: null,
    identificadorLocal: 'banca-1',
    tipoBancaId: 'entrevista',
    regraDeDeliberacao: null,
    copiaDoTipo: null,
    ...parcial,
  };
}

/** A mesma banca, na fase, sem categorias de candidatos atendidos. */
export function umaBancaRequeridaDaFase(
  parcial: Partial<BancaRequeridaDaFase> = {},
): BancaRequeridaDaFase {
  return { ...umaBancaDeclarada(), categoriasDocumentoIds: [], ...parcial };
}
