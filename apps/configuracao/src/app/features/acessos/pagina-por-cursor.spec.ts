import { DestroyRef } from '@angular/core';
import type { ApiResult, Cursor, CursorPagina } from '@uniplus/shared-core/http';
import { Observable, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { PaginaPorCursor } from './pagina-por-cursor';
import { ok, recusa } from './testes';

const LINK =
  '</api/x?cursor=ANT&direction=prev>; rel="prev", </api/x?cursor=PROX&direction=next>; rel="next"';

type Buscar = (pagina?: CursorPagina) => Observable<ApiResult<readonly string[]>>;

function criar(buscar: Buscar) {
  return new PaginaPorCursor<string>(buscar, {
    onDestroy: () => undefined,
  } as unknown as DestroyRef);
}

describe('PaginaPorCursor', () => {
  it('guarda os itens e os cursores da página', () => {
    const pagina = criar(vi.fn((_pagina?: CursorPagina) => of(ok(['a', 'b'], LINK))));

    pagina.carregar();

    expect(pagina.itens()).toEqual(['a', 'b']);
    expect(pagina.anterior()).not.toBeNull();
    expect(pagina.proximo()).not.toBeNull();
    expect(pagina.carregando()).toBe(false);
  });

  it('segue o cursor da próxima página e o da anterior', () => {
    const buscar = vi.fn((_pagina?: CursorPagina) => of(ok(['a'], LINK)));
    const pagina = criar(buscar);
    pagina.carregar();

    pagina.proxima();
    pagina.voltar();

    expect(buscar).toHaveBeenNthCalledWith(2, { cursor: 'PROX' as Cursor, direction: 'next' });
    expect(buscar).toHaveBeenNthCalledWith(3, { cursor: 'ANT' as Cursor, direction: 'prev' });
  });

  it('não navega quando não há cursor', () => {
    const buscar = vi.fn((_pagina?: CursorPagina) => of(ok(['a'])));
    const pagina = criar(buscar);
    pagina.carregar();

    pagina.proxima();
    pagina.voltar();

    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it('esvazia a lista e guarda o problema quando a API recusa', () => {
    const pagina = criar(vi.fn((_pagina?: CursorPagina) => of(recusa('uniplus.x', 403))));

    pagina.carregar();

    expect(pagina.itens()).toEqual([]);
    expect(pagina.problema()?.code).toBe('uniplus.x');
    expect(pagina.proximo()).toBeNull();
  });

  it('sai do carregando e expõe a mensagem quando a busca falha', () => {
    const buscar = vi.fn((_pagina?: CursorPagina) => throwError(() => new Error('falhou')));
    const pagina = criar(buscar);

    pagina.carregar();

    expect(pagina.carregando()).toBe(false);
    expect(pagina.problema()?.title).toBe('Não foi possível carregar a lista. Tente novamente.');
    expect(pagina.itens()).toEqual([]);
  });
});
