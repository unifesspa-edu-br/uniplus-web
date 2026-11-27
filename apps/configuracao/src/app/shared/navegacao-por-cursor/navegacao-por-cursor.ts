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

type ListaPaginada<T> = Pick<
  UseApiResourceRef<readonly T[]>,
  'value' | 'headers' | 'isLoading' | 'error'
>;

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

type RespostaLida<T> = { envelope: ApiResult<readonly T[]> | undefined; erro: unknown };

function respostaRecusada<T>(envelope: RespostaLida<T>['envelope'], erro: unknown): boolean {
  return Boolean(erro) || (envelope !== undefined && !envelope.ok);
}

/**
 * Valor derivado da resposta da listagem. Enquanto a resposta não chega, mantém o que já havia; a
 * falha na primeira página esvazia, e numa página navegada preserva a página atual.
 */
function derivadoDaResposta<T, R>(
  lista: ListaPaginada<T>,
  pagina: Signal<CursorPagina | undefined>,
  vazio: R,
  derivar: (dados: readonly T[]) => R,
): WritableSignal<R> {
  return linkedSignal<RespostaLida<T>, R>({
    source: () => ({ envelope: lista.value(), erro: lista.error() }),
    computation: ({ envelope, erro }, anterior) => {
      const atual = anterior?.value ?? vazio;
      if (!respostaRecusada(envelope, erro)) return envelope?.ok ? derivar(envelope.data) : atual;
      return untracked(() => pagina() === undefined) ? vazio : atual;
    },
  });
}

function cursoresDaListagem<T>(
  lista: ListaPaginada<T>,
  pagina: Signal<CursorPagina | undefined>,
): WritableSignal<Cursores> {
  return derivadoDaResposta<T, Cursores>(lista, pagina, SEM_CURSORES, () => {
    const link = untracked(() => lista.headers()?.get('Link') ?? null);
    return { anterior: extractPrevCursor(link), proximo: extractNextCursor(link) };
  });
}

function irParaCursor<T>(
  lista: ListaPaginada<T>,
  pagina: WritableSignal<CursorPagina | undefined>,
  cursor: Cursor | null,
  direction: CursorPagina['direction'],
): void {
  if (cursor !== null && !lista.isLoading()) {
    pagina.set({ cursor, direction });
  }
}

function esvaziarPagina<T>(
  itens: WritableSignal<readonly T[]>,
  cursores: WritableSignal<Cursores>,
): void {
  itens.set([]);
  cursores.set(SEM_CURSORES);
}

/** Deriva de uma listagem por `useApiResource` os itens e os cursores do header `Link`. */
export function navegacaoPorCursor<T>(
  lista: ListaPaginada<T>,
  pagina: WritableSignal<CursorPagina | undefined>,
): NavegacaoPorCursor<T> {
  const cursores = cursoresDaListagem(lista, pagina);
  const itens = derivadoDaResposta<T, readonly T[]>(lista, pagina, [], (dados) => [...dados]);
  return {
    itens,
    anterior: computed(() => cursores().anterior),
    proximo: computed(() => cursores().proximo),
    irParaProxima: () => irParaCursor(lista, pagina, cursores().proximo, 'next'),
    irParaAnterior: () => irParaCursor(lista, pagina, cursores().anterior, 'prev'),
    esvaziar: () => esvaziarPagina(itens, cursores),
  };
}
