import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { AUTORIZACAO_BASE_PATH } from '@uniplus/shared-data/autorizacao';
import { ConcessoesStore } from './concessoes.store';
import { PedidosStore } from './pedidos.store';
import { PerfisStore } from './perfis.store';

const BASE = 'http://api.test/api/autorizacao';
const LINK =
  '</api/itens?cursor=abc&direction=next>; rel="next", </api/itens?cursor=xyz&direction=prev>; rel="prev"';

describe('Paginação dos acessos', () => {
  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  it.each([
    ['pedidos-de-concessao', PedidosStore],
    ['concessoes', ConcessoesStore],
    ['perfis', PerfisStore],
  ] as const)('%s preserva a página navegada e limpa a primeira em falha', async (rota, tipo) => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
        tipo,
      ],
    });
    const store = TestBed.inject(tipo as Type<PedidosStore | ConcessoesStore | PerfisStore>);
    if (store instanceof PedidosStore) store.fila.set('meus');
    const http = TestBed.inject(HttpTestingController);
    const atualizar = async () => {
      await Promise.resolve();
      TestBed.tick();
    };
    await atualizar();
    http
      .expectOne((req) => req.url === `${BASE}/${rota}`)
      .flush([{ id: 'primeiro' }], { headers: { Link: LINK } });
    await atualizar();
    expect(store.itens()).toEqual([{ id: 'primeiro' }]);
    const anterior = store.anterior();
    const proximo = store.proximo();
    expect(anterior).not.toBeNull();
    expect(proximo).not.toBeNull();
    store.proximaPagina();
    await atualizar();
    http
      .expectOne((req) => req.url === `${BASE}/${rota}` && req.params.has('cursor'))
      .flush(
        { title: 'Falha', status: 500, code: 'erro', type: 'about:blank', traceId: '' },
        {
          status: 500,
          statusText: 'Erro',
          headers: { 'Content-Type': 'application/problem+json' },
        },
      );
    await atualizar();
    expect(store.itens()).toEqual([{ id: 'primeiro' }]);
    expect(store.anterior()).toEqual(anterior);
    expect(store.proximo()).toEqual(proximo);
    store.recarregar();
    await atualizar();
    http
      .expectOne((req) => req.url === `${BASE}/${rota}` && !req.params.has('cursor'))
      .flush(
        { title: 'Falha', status: 500, code: 'erro', type: 'about:blank', traceId: '' },
        {
          status: 500,
          statusText: 'Erro',
          headers: { 'Content-Type': 'application/problem+json' },
        },
      );
    await atualizar();
    expect(store.itens()).toEqual([]);
    expect(store.anterior()).toBeNull();
    expect(store.proximo()).toBeNull();
  });

  it.each([
    ['pedidos-de-concessao', PedidosStore],
    ['concessoes', ConcessoesStore],
  ] as const)(
    '%s: escolher a situação que já está escolhida recarrega a lista',
    async (rota, tipo) => {
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(withInterceptors([apiResultInterceptor])),
          provideHttpClientTesting(),
          { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
          tipo,
        ],
      });
      const store = TestBed.inject(tipo as Type<PedidosStore | ConcessoesStore>);
      if (store instanceof PedidosStore) store.fila.set('meus');
      const http = TestBed.inject(HttpTestingController);
      const atualizar = async () => {
        await Promise.resolve();
        TestBed.tick();
      };
      await atualizar();
      http.expectOne((req) => req.url === `${BASE}/${rota}`).flush([]);
      await atualizar();

      store.filtrarPor(store.situacao() as never);
      await atualizar();

      http.expectOne((req) => req.url === `${BASE}/${rota}`).flush([]);
    },
  );
});
