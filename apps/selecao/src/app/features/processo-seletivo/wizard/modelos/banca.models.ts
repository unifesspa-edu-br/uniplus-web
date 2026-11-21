import type { RegraDeDeliberacaoDaBanca } from './deliberacao.models';

export interface BancaDeclarada {
  readonly id: string | null;
  readonly identificadorLocal: string;
  readonly tipoBancaId: string;
  readonly regraDeDeliberacao: RegraDeDeliberacaoDaBanca | null;
  readonly posicaoNoTipo?: number;
  readonly copiaDoTipo: {
    readonly rotulo: string;
    readonly papel: { readonly codigo: string; readonly rotulo?: string } | null;
    readonly exigeDuasOuMaisBancas: boolean;
    readonly encerraRecursoNaPrimeiraInstancia: boolean;
  } | null;
}

export type BancaDaEtapa = BancaDeclarada;

export interface BancaRequeridaDaFase extends BancaDeclarada {
  readonly categoriasDocumentoIds: readonly string[];
}
