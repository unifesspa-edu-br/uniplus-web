import { ProblemValidationError } from './problem-details';

export type CausaDeCampo = ProblemValidationError & { readonly field: string };

export type CausaGeral = Omit<ProblemValidationError, 'field'>;

export interface CausasDoProblema {
  readonly deCampo: readonly CausaDeCampo[];
  readonly gerais: readonly CausaGeral[];
}

function apontaCampo(causa: ProblemValidationError): causa is CausaDeCampo {
  return typeof causa.field === 'string';
}

/**
 * Separa as causas que apontam um campo (inclusive a raiz, `field: ""`) das gerais, que a
 * API envia sem a chave `field`. As duas listas mantêm a ordem recebida.
 */
export function separarCausas(
  erros: ReadonlyArray<ProblemValidationError> | undefined,
): CausasDoProblema {
  const causas = erros ?? [];
  return {
    deCampo: causas.filter(apontaCampo),
    gerais: causas.filter((causa) => !apontaCampo(causa)),
  };
}
