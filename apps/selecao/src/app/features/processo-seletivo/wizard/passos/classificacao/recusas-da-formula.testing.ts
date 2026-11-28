import type { RecusasDaFormula } from './recusas-da-formula';

/** As recusas de uma resposta que traz só a recusa pelo desempate. */
export function soPeloDesempate(mensagem: string): RecusasDaFormula {
  return { daResolucao: { julgada: false }, peloDesempate: mensagem, daEscala: null };
}
