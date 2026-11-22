import { emOrdem, type RecusaOrdenada } from '../recusas/ordem-das-recusas';
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

/** As recusas do servidor à regra de uma banca, reunidas pelo controle que cada uma aponta. */
export type RecusasDaBancaPorCampo = Partial<Record<CampoDaBanca, readonly RecusaOrdenada[]>>;

/**
 * As recusas que o seletor do modo mostra: a dele, a da regra inteira e a de todo controle que a
 * tela não mostra para a regra atual, para que nenhuma recusa fique sem lugar.
 */
export function recusasDoModo(
  recusas: RecusasDaBancaPorCampo,
  aVista: ReadonlySet<CampoDaRegra>,
): readonly RecusaOrdenada[] {
  const campos = CAMPOS_DA_BANCA.filter(
    (campo) => campo === 'modo' || campo === 'regra' || !aVista.has(campo),
  );
  return emOrdem(campos.flatMap((campo) => recusas[campo] ?? []));
}
