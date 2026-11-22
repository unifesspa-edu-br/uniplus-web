import type { RecusaOrdenada } from '../recusas/ordem-das-recusas';
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

/** As recusas do servidor a uma banca reunidas por campo: só os campos que têm recusa. */
export type RecusasDaBancaPorCampo = Partial<Record<CampoDaBanca, readonly RecusaOrdenada[]>>;

export function recusasDaBancaPorCampo(
  recusasDe: (campo: CampoDaBanca) => readonly RecusaOrdenada[],
): RecusasDaBancaPorCampo {
  return Object.fromEntries(
    CAMPOS_DA_BANCA.map((campo) => [campo, recusasDe(campo)] as const).filter(
      ([, recusas]) => recusas.length > 0,
    ),
  );
}

const CAMPO_DA_REGRA_PELO_NOME: ReadonlyMap<string, CampoDaBanca> = new Map(
  CAMPOS_DA_BANCA.map((campo) => [campo.toLowerCase(), campo]),
);

/**
 * O campo da banca que o caminho dentro dela aponta, como `regraDeDeliberacao.quorum`: o campo da
 * regra, ou `regra` quando o caminho aponta a regra sem campo próprio. `null` quando o caminho não
 * é da regra (a banca inteira, ou o tipo dela).
 */
export function campoDaBancaNoCaminho([
  parte = '',
  campo = '',
]: readonly string[]): CampoDaBanca | null {
  if (parte.toLowerCase() !== 'regradedeliberacao') return null;
  return CAMPO_DA_REGRA_PELO_NOME.get(campo.toLowerCase()) ?? 'regra';
}

/**
 * Os elementos que podem receber o foco quando a recusa ao campo é o primeiro problema do passo,
 * do preferido ao de reserva: o controle, o bloco das recusas dele e, quando o controle não está na
 * tela, o bloco do modo, sob o qual a recusa aparece. A regra inteira também aparece sob o modo.
 */
export function alvosDaRecusaDaBanca(idBase: string, campo: CampoDaBanca): readonly string[] {
  const controle = campo === 'regra' ? 'modo' : campo;
  const ids = [controle, `${controle}-recusas`, 'modo-recusas'];
  return [...new Set(ids)].map((parte) => `${idBase}-${parte}`);
}
