import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor, buildVendorMimeAccept, isApiOk } from '@uniplus/shared-core/http';
import {
  TipoInstrumentoNormativoCodigo,
  type TipoInstrumentoNormativoComDescricao,
  TiposInstrumentoNormativoApi,
} from './tipos-instrumento-normativo.api';
import { CONFIGURACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';

const tipoDoVocabulario: TipoInstrumentoNormativoComDescricao = {
  codigo: TipoInstrumentoNormativoCodigo.PORTARIA,
  rotulo: 'Rótulo do tipo de teste',
  descricao: 'Descrição do tipo de teste.',
};

describe('TiposInstrumentoNormativoApi', () => {
  let api: TiposInstrumentoNormativoApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(TiposInstrumentoNormativoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('listar() faz GET do vocabulário com o Accept versionado', async () => {
    const promise = firstValueFrom(api.listar());
    const req = controller.expectOne(
      `${BASE}/api/configuracao/vocabularios/tipos-instrumento-normativo`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('codigo-tipo-instrumento-normativo', 1),
    );
    req.flush([tipoDoVocabulario]);
    await promise;
  });

  it('listar() entrega código, rótulo e descrição como a API os enviou', async () => {
    const promise = firstValueFrom(api.listar());
    controller
      .expectOne(`${BASE}/api/configuracao/vocabularios/tipos-instrumento-normativo`)
      .flush([tipoDoVocabulario]);
    const resultado = await promise;
    expect(isApiOk(resultado) ? resultado.data : null).toEqual([tipoDoVocabulario]);
  });
});
