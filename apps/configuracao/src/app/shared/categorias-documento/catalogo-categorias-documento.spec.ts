import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  type CategoriaDocumentoDto,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CatalogoCategoriasDocumento } from './catalogo-categorias-documento';

const BASE = 'http://localhost:5000';
const URL = `${BASE}/api/configuracao/categorias-documento`;

const identificacao: CategoriaDocumentoDto = {
  id: 'ca7e0000-0000-7000-8000-000000000001',
  codigo: 'IDENTIFICACAO',
  nome: 'Identificação',
  descricao: null,
  ordem: 1,
  criadoEm: '2026-01-01T00:00:00Z',
};

const titulacao: CategoriaDocumentoDto = {
  id: 'ca7e0000-0000-7000-8000-000000000003',
  codigo: 'TITULACAO_EXPERIENCIA',
  nome: 'Titulação e experiência',
  descricao: null,
  ordem: 3,
  criadoEm: '2026-01-01T00:00:00Z',
};

describe('CatalogoCategoriasDocumento', () => {
  let catalogo: CatalogoCategoriasDocumento;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    catalogo = TestBed.inject(CatalogoCategoriasDocumento);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('busca o catálogo na primeira chamada e o expõe indexado por código', () => {
    catalogo.garantirCarregado();
    controller.expectOne(URL).flush([identificacao, titulacao]);

    expect(catalogo.opcoes().length).toBe(2);
    expect(catalogo.porCodigo().get('TITULACAO_EXPERIENCIA')?.nome).toBe('Titulação e experiência');
    expect(catalogo.pendente()).toBe(false);
    expect(catalogo.comErro()).toBe(false);
  });

  // CA-07: reentrar no cadastro não pode custar uma requisição nova.
  it('reaproveita o catálogo já carregado nas chamadas seguintes', () => {
    catalogo.garantirCarregado();
    controller.expectOne(URL).flush([identificacao]);

    catalogo.garantirCarregado();
    catalogo.garantirCarregado();

    controller.verify();
    expect(catalogo.opcoes().length).toBe(1);
  });

  // Duas telas do cadastro podem pedir o catálogo antes de a primeira resposta
  // chegar; reiniciar a busca cancelaria a que já vinha, sem ganho nenhum.
  it('não reinicia a busca enquanto uma tentativa está em curso', () => {
    catalogo.garantirCarregado();
    catalogo.garantirCarregado();

    const req = controller.expectOne(URL);
    req.flush([identificacao]);
    expect(catalogo.opcoes().length).toBe(1);
  });

  it('tenta de novo ao reentrar na tela depois de uma recusa', () => {
    catalogo.garantirCarregado();
    controller
      .expectOne(URL)
      .flush(
        { title: 'Indisponível', status: 503 },
        { status: 503, statusText: 'Service Unavailable' },
      );
    expect(catalogo.comErro()).toBe(true);

    catalogo.garantirCarregado();
    controller.expectOne(URL).flush([identificacao]);

    expect(catalogo.comErro()).toBe(false);
    expect(catalogo.opcoes().length).toBe(1);
  });

  it('recarregar() busca de novo mesmo com o catálogo já carregado', () => {
    catalogo.garantirCarregado();
    controller.expectOne(URL).flush([identificacao]);

    catalogo.recarregar();
    controller.expectOne(URL).flush([identificacao, titulacao]);

    expect(catalogo.opcoes().length).toBe(2);
  });

  // O rótulo já correto não pode piscar para "Carregando…" enquanto a nova
  // tentativa corre: `lookupCompleto` preserva as opções da última busca boa.
  it('preserva as opções da última busca boa durante a nova tentativa', () => {
    catalogo.garantirCarregado();
    controller.expectOne(URL).flush([identificacao]);

    catalogo.recarregar();
    expect(catalogo.pendente()).toBe(true);
    expect(catalogo.opcoes().length).toBe(1);

    controller.expectOne(URL).flush([identificacao, titulacao]);
  });
});
