import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { AUTORIZACAO_BASE_PATH } from '@uniplus/shared-data/autorizacao';
import { ConcessoesStore } from './concessoes.store';
import { PedidoDetalheStore } from './pedido-detalhe.store';
import { PedidosStore } from './pedidos.store';
import { PedirAcessoStore } from './pedir-acesso.store';
import { PerfisStore } from './perfis.store';

const BASE = 'http://api.test/api/autorizacao';

interface Leitura {
  readonly nome: string;
  readonly store: Type<unknown>;
  readonly url: string;
  readonly iniciar?: (store: never) => void;
  /** As outras leituras que a mesma loja faz ao iniciar, com o corpo no formato do DTO. */
  readonly vizinhas?: readonly { readonly url: string; readonly corpo: object }[];
}

const LEITURAS: readonly Leitura[] = [
  { nome: 'lista de perfis', store: PerfisStore, url: `${BASE}/perfis` },
  {
    nome: 'catálogo de permissões',
    store: PerfisStore,
    url: `${BASE}/permissoes`,
    vizinhas: [{ url: `${BASE}/perfis`, corpo: [] }],
    iniciar: (store: PerfisStore) => store.carregarCatalogo(),
  },
  { nome: 'lista de concessões', store: ConcessoesStore, url: `${BASE}/concessoes` },
  {
    nome: 'trilha da concessão',
    store: ConcessoesStore,
    url: `${BASE}/concessoes/c1/trilha`,
    vizinhas: [{ url: `${BASE}/concessoes?situacao=ativa`, corpo: [] }],
    iniciar: (store: ConcessoesStore) => store.carregarTrilha('c1'),
  },
  {
    nome: 'lista de pedidos',
    store: PedidosStore,
    url: `${BASE}/pedidos-de-concessao`,
    iniciar: (store: PedidosStore) => store.fila.set('meus'),
  },
  {
    nome: 'pedido',
    store: PedidoDetalheStore,
    url: `${BASE}/pedidos-de-concessao/p1`,
    vizinhas: [{ url: `${BASE}/pedidos-de-concessao/p1/trilha`, corpo: [] }],
    iniciar: (store: PedidoDetalheStore) => store.id.set('p1'),
  },
  {
    nome: 'trilha do pedido',
    store: PedidoDetalheStore,
    url: `${BASE}/pedidos-de-concessao/p1/trilha`,
    vizinhas: [{ url: `${BASE}/pedidos-de-concessao/p1`, corpo: { id: 'p1' } }],
    iniciar: (store: PedidoDetalheStore) => store.id.set('p1'),
  },
  { nome: 'perfis para pedir acesso', store: PedirAcessoStore, url: `${BASE}/perfis-para-pedido` },
];

describe('falhas de leitura dos acessos', () => {
  const notificacoes = { errorFromProblem: vi.fn() };
  let http: HttpTestingController;

  const falhar = async (leitura: Leitura, status: number): Promise<void> => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
        { provide: NotificationService, useValue: notificacoes },
        leitura.store,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const store = TestBed.inject(leitura.store);
    leitura.iniciar?.(store as never);
    await Promise.resolve();
    TestBed.tick();
    // As vizinhas são lidas junto, mas não fazem parte desta falha: respondem com sucesso, e só
    // elas. Qualquer outra requisição fica pendente para o `verify` do `afterEach` acusar.
    for (const { url, corpo } of leitura.vizinhas ?? []) {
      http.expectOne((req) => req.urlWithParams === url).flush(corpo);
    }
    http
      .expectOne((req) => req.url === leitura.url)
      .flush(
        { type: 'x', title: 'Falha', status, code: 'erro', traceId: '' },
        { status, statusText: 'Erro', headers: { 'Content-Type': 'application/problem+json' } },
      );
    await Promise.resolve();
    TestBed.tick();
  };

  beforeEach(() => notificacoes.errorFromProblem.mockClear());
  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  it.each(LEITURAS)('$nome: a falha de servidor (5xx) vira notificação', async (leitura) => {
    await falhar(leitura, 503);

    expect(notificacoes.errorFromProblem).toHaveBeenCalledOnce();
    expect(notificacoes.errorFromProblem.mock.calls[0]?.[0]).toMatchObject({ status: 503 });
    expect(notificacoes.errorFromProblem.mock.calls[0]?.[1]).toEqual({ title: 'Falha' });
  });

  it.each(LEITURAS)('$nome: a recusa 4xx não vira notificação', async (leitura) => {
    await falhar(leitura, 403);

    expect(notificacoes.errorFromProblem).not.toHaveBeenCalled();
  });
});
