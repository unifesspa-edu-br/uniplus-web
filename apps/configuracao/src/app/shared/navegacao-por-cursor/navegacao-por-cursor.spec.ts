import { HttpHeaders } from '@angular/common/http';
import { signal } from '@angular/core';
import {
  ApiResult,
  CursorPagina,
  ProblemDetails,
  UseApiResourceRef,
  apiFailure,
  apiOk,
} from '@uniplus/shared-core/http';
import { describe, expect, it } from 'vitest';
import { navegacaoPorCursor } from './navegacao-por-cursor';

const LINK =
  '</api/itens?cursor=abc&direction=next>; rel="next", </api/itens?cursor=xyz&direction=prev>; rel="prev"';
const PROBLEMA = { status: 500, title: 'Falha' } as ProblemDetails;

function criar() {
  const value = signal<ApiResult<readonly string[]> | undefined>(undefined);
  const headers = signal<HttpHeaders | undefined>(undefined);
  const carregando = signal(false);
  const error = signal<unknown>(undefined);
  const lista = { value, headers, error, isLoading: carregando } as unknown as UseApiResourceRef<
    readonly string[]
  >;
  const pagina = signal<CursorPagina | undefined>(undefined);
  const navegacao = navegacaoPorCursor(lista, pagina);
  const responder = (resultado: ApiResult<readonly string[]>): void => {
    headers.set(resultado.headers);
    value.set(resultado);
  };
  return { navegacao, pagina, carregando, responder, error };
}

describe('navegacaoPorCursor', () => {
  it('lê os itens e os cursores do header Link', () => {
    const { navegacao, responder } = criar();
    responder(apiOk(['a', 'b'], 200, new HttpHeaders({ Link: LINK })));

    expect(navegacao.itens()).toEqual(['a', 'b']);
    expect(navegacao.proximo()).not.toBeNull();
    expect(navegacao.anterior()).not.toBeNull();
  });

  it('esvazia na falha da primeira página', () => {
    const { navegacao, responder } = criar();
    responder(apiOk(['a'], 200, new HttpHeaders({ Link: LINK })));
    responder(apiFailure(PROBLEMA, 500, new HttpHeaders()));

    expect(navegacao.itens()).toEqual([]);
    expect(navegacao.proximo()).toBeNull();
  });

  it('preserva a página atual na falha de uma página navegada', () => {
    const { navegacao, pagina, responder } = criar();
    responder(apiOk(['a'], 200, new HttpHeaders({ Link: LINK })));
    expect(navegacao.itens()).toEqual(['a']);
    navegacao.irParaProxima();
    expect(pagina()?.direction).toBe('next');
    responder(apiFailure(PROBLEMA, 500, new HttpHeaders()));

    expect(navegacao.itens()).toEqual(['a']);
    expect(navegacao.proximo()).not.toBeNull();
  });

  it.each([false, true])('trata exceção de leitura na página navegada: %s', (navegada) => {
    const { navegacao, responder, error } = criar();
    responder(apiOk(['a'], 200, new HttpHeaders({ Link: LINK })));
    expect(navegacao.itens()).toEqual(['a']);
    expect(navegacao.anterior()).not.toBeNull();
    if (navegada) navegacao.irParaProxima();

    error.set(new Error('interceptor'));

    expect(navegacao.itens()).toEqual(navegada ? ['a'] : []);
    expect(navegacao.anterior() === null).toBe(!navegada);
    expect(navegacao.proximo() === null).toBe(!navegada);
  });

  it('não navega enquanto uma consulta está em curso', () => {
    const { navegacao, pagina, carregando, responder } = criar();
    responder(apiOk(['a'], 200, new HttpHeaders({ Link: LINK })));
    carregando.set(true);
    navegacao.irParaProxima();

    expect(pagina()).toBeUndefined();
  });
});
