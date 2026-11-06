import { ApplicationRef } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, TipoDeficienciaDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TiposDeficienciaStore } from './tipos-deficiencia.store';

const BASE = 'http://localhost:5000';
const URL = `${BASE}/api/configuracao/tipos-deficiencia`;
const RECURSO: TipoDeficienciaDto = {
  id: '019f41cf-69fd-759a-ac6d-09acabc1b027',
  codigo: 'VISUAL',
  nome: 'Visual',
  descricao: 'Baixa visão',
  permanente: null,
  criadoEm: '2026-07-07T13:23:42.707136+00:00',
};

describe('TiposDeficienciaStore', () => {
  let store: TiposDeficienciaStore;
  let http: HttpTestingController;
  let app: ApplicationRef;

  const atualizar = async (): Promise<void> => {
    await Promise.resolve();
    app.tick();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TiposDeficienciaStore,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    store = TestBed.inject(TiposDeficienciaStore);
    http = TestBed.inject(HttpTestingController);
    app = TestBed.inject(ApplicationRef);
    app.tick();
  });

  afterEach(() => http.verify());

  it('preserva a página e o cursor quando a navegação falha', async () => {
    const primeira = http.expectOne(URL + '?limit=50');
    primeira.flush([RECURSO], {
      headers: { Link: '</api/itens?cursor=abc&direction=next>; rel="next"' },
    });
    await atualizar();
    expect(store.tiposDeficiencia()).toEqual([RECURSO]);
    store.proximaPagina();
    await atualizar();
    const proxima = http.expectOne((req) => req.url === URL);
    expect(proxima.request.params.get('cursor')).toBe('abc');
    expect(proxima.request.params.get('direction')).toBe('next');
    proxima.flush(null, { status: 500, statusText: 'Erro' });
    await atualizar();
    expect(store.tiposDeficiencia()).toEqual([RECURSO]);
    expect(store.proximo()).not.toBeNull();
    expect(store.mensagemDeErro()).not.toBeNull();
  });

  it('recarrega a primeira página após navegar', async () => {
    http.expectOne(URL + '?limit=50').flush([RECURSO], {
      headers: { Link: '</api/itens?cursor=abc&direction=next>; rel="next"' },
    });
    await atualizar();
    store.proximaPagina();
    await atualizar();
    http.expectOne((req) => req.url === URL).flush([]);
    await atualizar();
    store.recarregar();
    await atualizar();
    http.expectOne(URL + '?limit=50').flush([RECURSO]);
    await atualizar();
    expect(store.tiposDeficiencia()).toEqual([RECURSO]);
  });
});
