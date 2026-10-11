import { formatarDataBr } from '@uniplus/shared-utils';

import type { TermoDisponivel } from './formulario-editavel';

/** O termo de consentimento como o cadastro o devolve, só no que o editor usa. */
export interface TermoComVersoes {
  readonly id: string;
  readonly nome: string;
  readonly versoes: readonly { readonly id: string; readonly promovidaEm: string }[];
}

/**
 * O termo de consentimento como o editor o oferece: as versões promovidas, a mais nova primeiro —
 * é a que um termo recém-exigido recebe —, nomeadas pela data da promoção.
 */
export function termoDisponivelDe(termo: TermoComVersoes): TermoDisponivel {
  return {
    termoId: termo.id,
    nome: termo.nome,
    versoes: [...termo.versoes]
      .sort((a, b) => b.promovidaEm.localeCompare(a.promovidaEm))
      .map((versao) => ({ versaoId: versao.id, rotulo: `Versão de ${formatarDataBr(versao.promovidaEm, 'datetime')}` })),
  };
}
