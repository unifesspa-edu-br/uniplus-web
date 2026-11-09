import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { AUTORIZACAO_BASE_PATH } from '@uniplus/shared-data/autorizacao';
import { CatalogoDePermissoesStore } from './catalogo-de-permissoes.store';

const URL = 'http://api.test/api/autorizacao/permissoes';
const CATALOGO = [
  {
    modulo: 'selecao',
    resources: [
      {
        resource: 'processos',
        permissoes: [
          { codigo: 'selecao:processos:consultar', nome: 'Consultar processos', descricao: '', sensibilidade: 'interno' },
        ],
      },
    ],
  },
];

describe('CatalogoDePermissoesStore', () => {
  let http: HttpTestingController;
  let store: CatalogoDePermissoesStore;
  const aguardar = async (): Promise<void> => {
    await Promise.resolve();
    TestBed.tick();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
        { provide: NotificationService, useValue: { errorFromProblem: vi.fn() } },
        CatalogoDePermissoesStore,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(CatalogoDePermissoesStore);
  });
  afterEach(() => http.verify());

  it('só lê o catálogo quando alguém pede', async () => {
    await aguardar();
    http.expectNone(URL);

    store.carregar();
    await aguardar();
    http.expectOne(URL).flush(CATALOGO);
    await aguardar();

    expect(store.modulos()).toHaveLength(1);
    expect(store.porCodigo().get('selecao:processos:consultar')).toEqual({
      codigo: 'selecao:processos:consultar',
      nome: 'Consultar processos',
      sensibilidade: 'interno',
    });
  });

  it('relê o catálogo a cada pedido depois do primeiro', async () => {
    store.carregar();
    await aguardar();
    http.expectOne(URL).flush(CATALOGO);
    await aguardar();

    store.carregar();
    await aguardar();

    http.expectOne(URL).flush(CATALOGO);
  });

  it('depois da falha, tentar novamente repete a leitura', async () => {
    store.carregar();
    await aguardar();
    http
      .expectOne(URL)
      .flush({ type: 'x', title: 'Falha', status: 503, code: 'erro', traceId: '' }, { status: 503, statusText: 'Erro', headers: { 'Content-Type': 'application/problem+json' } });
    await aguardar();
    expect(store.falha()).not.toBeNull();

    expect(store.tentarNovamente()).toBe(true);
    await aguardar();
    http.expectOne(URL).flush(CATALOGO);
    await aguardar();

    expect(store.falha()).toBeNull();
    expect(store.modulos()).toHaveLength(1);
  });
});
