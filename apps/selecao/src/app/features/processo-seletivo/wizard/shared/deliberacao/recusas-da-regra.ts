import type { CampoDaRegra } from './regra-de-deliberacao';

/** Onde a recusa aparece na regra de uma banca: um campo dela, ou a regra inteira. */
export type CampoDaBanca = CampoDaRegra | 'regra';

/** Todo lugar sob o qual a recusa à regra de uma banca pode aparecer. */
export const CAMPOS_DA_BANCA: readonly CampoDaBanca[] = [
  'regra',
  'modo',
  'integrantes',
  'suplentes',
  'quorum',
  'criterio',
  'desempate',
  'encerramento',
  'semUnanimidade',
];

/** As recusas de uma banca reunidas por campo: só os campos para os quais `erroDe` devolve texto. */
export function errosDaBancaPorCampo(
  erroDe: (campo: CampoDaBanca) => string | null | undefined,
): Partial<Record<CampoDaBanca, string>> {
  return Object.fromEntries(
    CAMPOS_DA_BANCA.flatMap((campo) => {
      const erro = erroDe(campo);
      return erro ? [[campo, erro]] : [];
    }),
  );
}
