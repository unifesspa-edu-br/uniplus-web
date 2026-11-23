import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { FormaDeComprovacaoCodigo, SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { CatalogoDasFormasDeComprovacao } from './catalogo-das-formas-de-comprovacao.service';

const ENDERECO = 'http://localhost:5000/api/selecao/vocabularios/formas-comprovacao';
const FORMAS = [{ codigo: FormaDeComprovacaoCodigo.DOCUMENTO, rotulo: 'Rótulo da API' }];

describe('CatalogoDasFormasDeComprovacao', () => {
  let catalogo: CatalogoDasFormasDeComprovacao;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CatalogoDasFormasDeComprovacao,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: 'http://localhost:5000' },
      ],
    });
    catalogo = TestBed.inject(CatalogoDasFormasDeComprovacao);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('carrega uma vez e reaproveita a lista, inclusive enquanto aguarda a resposta', () => {
    catalogo.carregar();
    catalogo.carregar();
    expect(catalogo.situacao()).toBe('carregando');
    http.expectOne(ENDERECO).flush(FORMAS);
    catalogo.carregar();
    http.expectNone(ENDERECO);
    expect(catalogo.situacao()).toBe('pronto');
    expect(catalogo.formas()).toEqual(FORMAS);
  });

  it('apresenta a falha e permite repetir a leitura', () => {
    catalogo.carregar();
    http.expectOne(ENDERECO).flush(null, { status: 500, statusText: 'Erro' });
    expect(catalogo.situacao()).toBe('falhou');
    expect(catalogo.erro()).toBe(
      'Não foi possível carregar as formas de comprovação. Tente novamente.',
    );
    catalogo.repetir();
    expect(catalogo.situacao()).toBe('carregando');
    http.expectOne(ENDERECO).flush(FORMAS);
    expect(catalogo.situacao()).toBe('pronto');
    expect(catalogo.erro()).toBeNull();
    expect(catalogo.formas()).toEqual(FORMAS);
  });
});
