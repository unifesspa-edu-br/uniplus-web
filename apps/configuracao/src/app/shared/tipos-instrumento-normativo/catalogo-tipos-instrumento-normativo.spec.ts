import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  type TipoInstrumentoNormativoVocabularioDto,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CatalogoTiposInstrumentoNormativo } from './catalogo-tipos-instrumento-normativo';

const BASE = 'http://localhost:5000';
const URL = `${BASE}/api/configuracao/vocabularios/tipos-instrumento-normativo`;

const portaria: TipoInstrumentoNormativoVocabularioDto = {
  codigo: 'PORTARIA',
  nome: 'Portaria',
  descricao: 'Ato administrativo de autoridade pública.',
};

const lei: TipoInstrumentoNormativoVocabularioDto = {
  codigo: 'LEI',
  nome: 'Lei',
  descricao: 'Ato normativo de maior hierarquia.',
};

describe('CatalogoTiposInstrumentoNormativo', () => {
  let catalogo: CatalogoTiposInstrumentoNormativo;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    catalogo = TestBed.inject(CatalogoTiposInstrumentoNormativo);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('busca o vocabulário na URL do endpoint e o expõe indexado por código', () => {
    catalogo.garantirCarregado();
    controller.expectOne(URL).flush([portaria, lei]);

    expect(catalogo.opcoes().length).toBe(2);
    expect(catalogo.porCodigo().get('PORTARIA')?.nome).toBe('Portaria');
    expect(catalogo.comErro()).toBe(false);
  });

  it('sinaliza recusa quando o vocabulário não chega', () => {
    catalogo.garantirCarregado();
    controller
      .expectOne(URL)
      .flush(
        { title: 'Indisponível', status: 503 },
        { status: 503, statusText: 'Service Unavailable' },
      );

    expect(catalogo.comErro()).toBe(true);
    expect(catalogo.opcoes().length).toBe(0);
  });
});
