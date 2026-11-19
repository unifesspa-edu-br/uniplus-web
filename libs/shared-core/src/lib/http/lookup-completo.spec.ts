import { HttpHeaders } from '@angular/common/http';
import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiResult, apiOk } from './api-result';
import { errorResult, mockProblemDetails } from './api-result.testing';
import { Cursor, createCursor } from './pagination';
import { lookupCompleto } from './lookup-completo';

type Catalogo = ApiResult<readonly string[]>;

function pagina(dados: readonly string[], proximo?: string): Catalogo {
  const headers = new HttpHeaders(
    proximo === undefined ? {} : { Link: `</api/x?cursor=${proximo}>; rel="next"` },
  );
  return apiOk<readonly string[]>(dados, 200, headers);
}

function respondendoEm(...respostas: readonly Observable<Catalogo>[]) {
  const consulta = vi.fn<(cursor?: Cursor) => Observable<Catalogo>>();
  respostas.forEach((resposta) => consulta.mockReturnValueOnce(resposta));
  return consulta;
}

function erroQueEscapaDoEnvelope(): Observable<Catalogo> {
  return throwError(() => new Error('rede caiu'));
}

const recusa = errorResult(
  mockProblemDetails({ type: 'about:blank', title: 'Indisponível', status: 503 }),
);

describe('lookupCompleto', () => {
  let destroyRef: DestroyRef;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    destroyRef = TestBed.inject(DestroyRef);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('expõe o catálogo inteiro seguindo o cursor até a última página', () => {
    const consulta = vi.fn((cursor?: Cursor) =>
      cursor === undefined ? of(pagina(['a'], 'p2')) : of(pagina(['b'])),
    );

    const lookup = lookupCompleto(consulta, destroyRef);
    lookup.recarregar();

    expect(lookup.opcoes()).toEqual(['a', 'b']);
    expect(lookup.comErro()).toBe(false);
    expect(consulta).toHaveBeenCalledTimes(2);
  });

  it('não busca nada antes de recarregar', () => {
    const consulta = vi.fn(() => of(pagina(['a'])));

    const lookup = lookupCompleto(consulta, destroyRef);

    expect(consulta).not.toHaveBeenCalled();
    expect(lookup.opcoes()).toEqual([]);
  });

  it('sinaliza a recusa do envelope sem oferecer catálogo pela metade', () => {
    const consulta = vi.fn((cursor?: Cursor) =>
      cursor === undefined ? of(pagina(['a'], 'p2')) : of(recusa),
    );

    const lookup = lookupCompleto(consulta, destroyRef);
    lookup.recarregar();

    expect(lookup.comErro()).toBe(true);
    expect(lookup.opcoes()).toEqual([]);
  });

  /**
   * O `apiResultInterceptor` envelopa todo `HttpErrorResponse`, mas um erro que
   * escape da cadeia deixaria a tela sem o alerta e subiria sem tratamento.
   */
  it('sinaliza erro que escapa do envelope', () => {
    const lookup = lookupCompleto(erroQueEscapaDoEnvelope, destroyRef);
    lookup.recarregar();

    expect(lookup.comErro()).toBe(true);
  });

  it('limpa o erro ao tentar de novo', () => {
    let falhar = true;
    const consulta = vi.fn(() => (falhar ? of(recusa) : of(pagina(['a']))));

    const lookup = lookupCompleto(consulta, destroyRef);
    lookup.recarregar();
    expect(lookup.comErro()).toBe(true);

    falhar = false;
    lookup.recarregar();

    expect(lookup.comErro()).toBe(false);
    expect(lookup.opcoes()).toEqual(['a']);
  });

  /**
   * Cliques repetidos em "Tentar novamente" abrem buscas concorrentes; sem
   * cancelamento, a resposta mais lenta chegaria por último e devolveria o
   * catálogo antigo ao `select`.
   */
  it('cancela a busca em andamento quando recarrega', () => {
    const primeira = new Subject<Catalogo>();
    const segunda = new Subject<Catalogo>();
    const lookup = lookupCompleto(respondendoEm(primeira, segunda), destroyRef);
    lookup.recarregar();
    lookup.recarregar();

    expect(primeira.observed).toBe(false);

    segunda.next(pagina(['novo']));
    primeira.next(pagina(['antigo']));

    expect(lookup.opcoes()).toEqual(['novo']);
  });

  it('para de acumular quando o componente é destruído', () => {
    const primeira = new Subject<Catalogo>();
    const lookup = lookupCompleto(respondendoEm(primeira), destroyRef);
    lookup.recarregar();

    TestBed.resetTestingModule();
    primeira.next(pagina(['tarde demais']));

    expect(lookup.opcoes()).toEqual([]);
  });

  /**
   * Sem esse sinal, catálogo vazio por busca em andamento e catálogo vazio por
   * cadastro sem itens são o mesmo estado para quem consome o lookup — e a
   * tela não tem como distinguir "carregando" de "não encontrado".
   */
  it('nasce pendente e só se resolve quando a busca termina', () => {
    const emVoo = new Subject<Catalogo>();
    const lookup = lookupCompleto(() => emVoo, destroyRef);
    // Já nasce pendente: um lookup lazy exibiria "não encontrado" antes do disparo.
    expect(lookup.pendente()).toBe(true);

    lookup.recarregar();
    expect(lookup.pendente()).toBe(true);

    emVoo.next(pagina(['a']));
    emVoo.complete();
    expect(lookup.pendente()).toBe(false);
  });

  it('deixa de estar pendente quando o envelope é recusado', () => {
    const lookup = lookupCompleto(() => of(recusa), destroyRef);
    lookup.recarregar();

    expect(lookup.comErro()).toBe(true);
    expect(lookup.pendente()).toBe(false);
  });

  it('deixa de estar pendente quando o erro escapa do envelope', () => {
    const lookup = lookupCompleto(erroQueEscapaDoEnvelope, destroyRef);
    lookup.recarregar();

    expect(lookup.comErro()).toBe(true);
    expect(lookup.pendente()).toBe(false);
  });

  it('volta a ficar pendente a cada nova tentativa', () => {
    const segunda = new Subject<Catalogo>();
    const lookup = lookupCompleto(respondendoEm(of(pagina(['a'])), segunda), destroyRef);
    lookup.recarregar();
    expect(lookup.pendente()).toBe(false);

    lookup.recarregar();
    expect(lookup.pendente()).toBe(true);

    segunda.next(pagina(['b']));
    segunda.complete();
    expect(lookup.pendente()).toBe(false);
  });

  it('encadeia as páginas na ordem em que o servidor as entrega', () => {
    const consulta = vi.fn((cursor?: Cursor) => {
      if (cursor === undefined) return of(pagina(['a'], 'p2'));
      if (cursor === createCursor('p2')) return of(pagina(['b'], 'p3'));
      return of(pagina(['c']));
    });

    const lookup = lookupCompleto(consulta, destroyRef);
    lookup.recarregar();

    expect(lookup.opcoes()).toEqual(['a', 'b', 'c']);
  });
});
