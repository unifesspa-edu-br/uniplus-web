import { HttpHeaders } from '@angular/common/http';
import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiResult, apiOk, type Cursor } from '@uniplus/shared-core/http';
import { Observable, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { listaDeReferencia } from './lista-de-referencia';

const SEGUNDA_PAGINA = '/itens?cursor=p2&direction=next';

function pagina(itens: readonly string[], proxima?: string): ApiResult<readonly string[]> {
  const headers = proxima === undefined ? new HttpHeaders() : new HttpHeaders({ Link: `<${proxima}>; rel="next"` });
  return apiOk<readonly string[]>(itens, 200, headers);
}

describe('listaDeReferencia', () => {
  it('recarga vazia mantém a lista completa anterior, com todas as páginas', () => {
    let respostas: ((cursor?: Cursor) => ApiResult<readonly string[]>) = (cursor) =>
      cursor === undefined ? pagina(['a', 'b'], SEGUNDA_PAGINA) : pagina(['c']);
    const listar = (cursor?: Cursor): Observable<ApiResult<readonly string[]>> => of(respostas(cursor));
    const lista = listaDeReferencia(listar, TestBed.inject(DestroyRef));

    lista.garantirCarregado();
    expect(lista.opcoes()).toEqual(['a', 'b', 'c']);

    respostas = () => pagina([]);
    lista.recarregar();

    expect(lista.opcoes()).toEqual(['a', 'b', 'c']);
    expect(lista.falhou()).toBe(false);
  });
});
