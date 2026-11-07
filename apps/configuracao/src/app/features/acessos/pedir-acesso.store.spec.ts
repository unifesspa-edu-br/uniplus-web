import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { AUTORIZACAO_BASE_PATH } from '@uniplus/shared-data/autorizacao';
import { PedirAcessoStore } from './pedir-acesso.store';

const URL = 'http://api.test/api/autorizacao/perfis-para-pedido';

describe('PedirAcessoStore', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
        PedirAcessoStore,
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  async function atualizar(): Promise<void> {
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();
  }
  it('reúne todas as páginas antes de oferecer os perfis', async () => {
    const store = TestBed.inject(PedirAcessoStore);
    await atualizar();
    const primeira = http.expectOne((r) => r.url === URL);
    expect(primeira.request.params.get('limit')).toBe('100');
    primeira.flush([{ id: 'p1' }], { headers: { Link: '</perfis?cursor=proximo>; rel="next"' } });
    await atualizar();
    expect(store.perfis()).toEqual([]);
    const segunda = http.expectOne((r) => r.url === URL);
    expect(segunda.request.params.get('cursor')).toBe('proximo');
    segunda.flush([{ id: 'p2' }]);
    await atualizar();
    expect(store.perfis().map((p) => p.id)).toEqual(['p1', 'p2']);
  });
  it('não oferece um catálogo parcial quando a página seguinte é recusada', async () => {
    const store = TestBed.inject(PedirAcessoStore);
    await atualizar();
    http
      .expectOne((r) => r.url === URL)
      .flush([{ id: 'p1' }], { headers: { Link: '</perfis?cursor=proximo>; rel="next"' } });
    await atualizar();
    http
      .expectOne((r) => r.url === URL)
      .flush(
        { title: 'Acesso negado', status: 403, type: 'about:blank', code: 'uniplus.x' },
        {
          status: 403,
          statusText: 'Forbidden',
          headers: { 'Content-Type': 'application/problem+json' },
        },
      );
    await atualizar();
    expect(store.perfis()).toEqual([]);
    expect(store.recusaDosPerfis()).toEqual({ texto: 'Acesso negado', status: 403 });
    expect(store.leituraDosPerfis.visivel()).toBe(false);
  });
});
