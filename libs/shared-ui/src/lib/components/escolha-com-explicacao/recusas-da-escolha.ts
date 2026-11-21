import type { RecusaDoCampo } from '../recusa-do-campo/recusa-do-campo';

/**
 * A recusa da API à escolha. Com `opcao` (o código de uma das opções), ela pertence só a essa
 * opção; sem `opcao`, ou com um código que não está entre as opções, pertence ao campo inteiro.
 */
export interface RecusaDaEscolha extends RecusaDoCampo {
  readonly opcao?: string;
}

/** Uma recusa pronta para o desenho: o identificador do seu elemento e a quem ela pertence. */
export interface RecusaNaTela {
  readonly id: string;
  readonly lista: readonly RecusaDoCampo[];
  /** O código da opção dona da recusa; `null` quando ela é do campo inteiro. */
  readonly opcao: string | null;
}

/**
 * Dá a cada recusa o identificador do seu elemento, formado por `base`, pela opção dona (quando
 * há) e pelo código da recusa. Recusas que repetem o mesmo identificador ganham um número ao fim,
 * para cada elemento poder ser citado sozinho por `aria-describedby`.
 */
export function recusasNaTela(
  recusas: readonly RecusaDaEscolha[],
  base: string,
  codigosDasOpcoes: ReadonlySet<string>,
): RecusaNaTela[] {
  const repeticoes = new Map<string, number>();
  return recusas.map((recusa) => {
    const opcao =
      recusa.opcao !== undefined && codigosDasOpcoes.has(recusa.opcao) ? recusa.opcao : null;
    const id = [base, opcao, recusa.codigo].filter((parte) => parte !== null).join('-');
    const vezes = (repeticoes.get(id) ?? 0) + 1;
    repeticoes.set(id, vezes);
    return { id: vezes === 1 ? id : `${id}-${vezes}`, lista: [recusa], opcao };
  });
}

/**
 * Os identificadores que descrevem quem é dono (`opcao`, ou `null` para o campo inteiro): as
 * recusas dele que ainda valem, as a conferir e, havendo alguma a conferir, a nota que as explica.
 */
export function idsDasRecusasDe(
  opcao: string | null,
  ativas: readonly RecusaNaTela[],
  aConferir: readonly RecusaNaTela[],
  idDaNota: string | null,
): string[] {
  const idsDeAtivas = ids(ativas, opcao);
  const idsDeAConferir = ids(aConferir, opcao);
  const nota = idsDeAConferir.length > 0 && idDaNota !== null ? [idDaNota] : [];
  return [...idsDeAtivas, ...idsDeAConferir, ...nota];
}

function ids(recusas: readonly RecusaNaTela[], opcao: string | null): string[] {
  return recusas.filter((recusa) => recusa.opcao === opcao).map((recusa) => recusa.id);
}
