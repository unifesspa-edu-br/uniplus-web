import type { RecusaDoCampo } from '@uniplus/shared-ui/components';

export type OrigemDaRecusa = 'gravacao' | 'publicacao';

/** Uma recusa do servidor com o que falta para dizer qual vem primeiro e se ainda vale. */
export interface RecusaOrdenada extends RecusaDoCampo {
  /** O campo sob o qual a recusa aparece. */
  readonly campo: string;
  /** A posição da recusa em `errors[]` da resposta que a trouxe. */
  readonly ordem: number;
  /** O número da resposta que a trouxe, dado por `NumeracaoDasRespostasRecusadas`. */
  readonly resposta: number;
  readonly origem: OrigemDaRecusa;
  /** A parte do cadastro mudou depois da recusa: ela segue à vista e será conferida de novo. */
  readonly aConferir: boolean;
  /** Um esclarecimento que a tela mostra junto da recusa, além da nota da conferência. */
  readonly nota?: string;
}

/**
 * As recusas na ordem em que a pessoa deve lê-las: as ativas antes das que estão a conferir; em
 * cada estado, a resposta mais recente primeiro; dentro da resposta, a ordem da API. O mesmo
 * campo com o mesmo código aparece uma vez, a que viria primeiro nessa ordem. O campo de um item
 * de lista traz a posição dele: o mesmo código em itens diferentes são recusas diferentes, e todas
 * aparecem.
 */
export function emOrdem<T extends RecusaOrdenada>(recusas: readonly T[]): T[] {
  return [...semRepeticao(recusas)].sort(vemAntes);
}

function vemAntes(a: RecusaOrdenada, b: RecusaOrdenada): number {
  return Number(a.aConferir) - Number(b.aConferir) || b.resposta - a.resposta || a.ordem - b.ordem;
}

function semRepeticao<T extends RecusaOrdenada>(recusas: readonly T[]): T[] {
  const escolhidas = new Map<string, T>();
  for (const recusa of recusas) {
    const chave = `${recusa.campo}\u0000${recusa.codigo}`;
    const atual = escolhidas.get(chave);
    if (atual === undefined || vemAntes(recusa, atual) < 0) escolhidas.set(chave, recusa);
  }
  return [...escolhidas.values()];
}

/** Alguma recusa ainda vale, isto é, a pessoa não alterou a parte do cadastro que ela aponta. */
export function haRecusaAtiva(recusas: readonly RecusaOrdenada[]): boolean {
  return recusas.some((recusa) => !recusa.aConferir);
}

/** A recusa guardada, sem o que só a guarda usa, com o estado da conferência que a tela mostra. */
export function comEstadoDaConferencia(
  guardada: Omit<RecusaOrdenada, 'aConferir'>,
  aConferir: boolean,
): RecusaOrdenada {
  const { campo, codigo, mensagem, pagina, ordem, resposta, origem } = guardada;
  return { campo, codigo, mensagem, pagina, ordem, resposta, origem, aConferir };
}

/**
 * A primeira recusa que a pessoa ainda precisa tratar: a da resposta mais recente e, nela, a que
 * a API deu primeiro. As que estão a conferir de novo não entram.
 */
export function primeiraRecusaAtiva<T extends { readonly recusa: RecusaOrdenada }>(
  candidatas: readonly T[],
): T | null {
  const ativas = candidatas.filter(({ recusa }) => !recusa.aConferir);
  const ordenadas = ativas.sort(
    (a, b) => b.recusa.resposta - a.recusa.resposta || a.recusa.ordem - b.recusa.ordem,
  );
  return ordenadas[0] ?? null;
}
