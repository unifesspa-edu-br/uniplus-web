import { Signal, WritableSignal, computed, linkedSignal, untracked } from '@angular/core';
import {
  ApiResult,
  Cursor,
  CursorPagina,
  UseApiResourceRef,
  extractNextCursor,
  extractPrevCursor,
} from '@uniplus/shared-core/http';

interface Cursores {
  readonly anterior: Cursor | null;
  readonly proximo: Cursor | null;
}

const SEM_CURSORES: Cursores = { anterior: null, proximo: null };

/** Itens da página corrente de uma listagem por cursor e a navegação entre as páginas. */
export interface NavegacaoPorCursor<T> {
  readonly itens: WritableSignal<readonly T[]>;
  readonly anterior: Signal<Cursor | null>;
  readonly proximo: Signal<Cursor | null>;
  irParaProxima(): void;
  irParaAnterior(): void;
  /** Zera itens e cursores, para uma nova consulta não exibir a anterior até o GET resolver. */
  esvaziar(): void;
}

/**
 * Valor derivado da resposta da listagem. Enquanto a resposta não chega, mantém o que já havia; a
 * falha na primeira página esvazia, e numa página navegada preserva a página atual.
 */
function derivadoDaResposta<T, R>(
  lista: UseApiResourceRef<readonly T[]>,
  pagina: Signal<CursorPagina | undefined>,
  vazio: R,
  derivar: (dados: readonly T[]) => R,
): WritableSignal<R> {
  return linkedSignal<ApiResult<readonly T[]> | undefined, R>({
    source: () => lista.value(),
    computation: (envelope, previous) => {
      const atual = previous?.value ?? vazio;
      if (envelope === undefined) {
        return atual;
      }
      if (!envelope.ok) {
        return untracked(() => pagina() === undefined) ? vazio : atual;
      }
      return derivar(envelope.data);
    },
  });
}

/** Deriva de uma listagem por `useApiResource` os itens e os cursores do header `Link`. */
export function navegacaoPorCursor<T>(
  lista: UseApiResourceRef<readonly T[]>,
  pagina: WritableSignal<CursorPagina | undefined>,
): NavegacaoPorCursor<T> {
  const cursores = derivadoDaResposta<T, Cursores>(lista, pagina, SEM_CURSORES, () => {
    const link = untracked(() => lista.headers()?.get('Link') ?? null);
    return { anterior: extractPrevCursor(link), proximo: extractNextCursor(link) };
  });
  const itens = derivadoDaResposta<T, readonly T[]>(lista, pagina, [], (dados) => [...dados]);

  const navegar = (cursor: Cursor | null, direction: CursorPagina['direction']): void => {
    if (cursor !== null && !lista.isLoading()) {
      pagina.set({ cursor, direction });
    }
  };

  return {
    itens,
    anterior: computed(() => cursores().anterior),
    proximo: computed(() => cursores().proximo),
    irParaProxima: () => navegar(cursores().proximo, 'next'),
    irParaAnterior: () => navegar(cursores().anterior, 'prev'),
    esvaziar: () => {
      itens.set([]);
      cursores.set(SEM_CURSORES);
    },
  };
}
