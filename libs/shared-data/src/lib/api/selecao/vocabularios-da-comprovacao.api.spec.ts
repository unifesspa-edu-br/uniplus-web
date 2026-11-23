import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor, buildVendorMimeAccept, isApiOk } from '@uniplus/shared-core/http';
import { FormaDeComprovacaoCodigo } from './schema';
import { SELECAO_BASE_PATH } from './tokens';
import { VocabulariosDaComprovacaoApi } from './vocabularios-da-comprovacao.api';

describe('VocabulariosDaComprovacaoApi', () => {
  let api: VocabulariosDaComprovacaoApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: 'http://localhost:5000' },
      ],
    });
    api = TestBed.inject(VocabulariosDaComprovacaoApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pede as formas de comprovação na versão 1 e devolve a lista', async () => {
    const resposta = firstValueFrom(api.listarFormasDeComprovacao());
    const pedido = http.expectOne(
      'http://localhost:5000/api/selecao/vocabularios/formas-comprovacao',
    );
    const formas = [{ codigo: FormaDeComprovacaoCodigo.DOCUMENTO, rotulo: 'Rótulo da API' }];

    expect(pedido.request.method).toBe('GET');
    expect(pedido.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('forma-de-comprovacao', 1),
    );
    pedido.flush(formas);
    const resultado = await resposta;
    expect(isApiOk(resultado) && resultado.data).toEqual(formas);
  });

  it.each([
    ['formatos-permitidos', 'formato-permitido', () => api.listarFormatosPermitidos()],
    [
      'criterios-distincao-apresentacoes',
      'criterio-distincao-apresentacoes',
      () => api.listarCriteriosDeDistincaoDeApresentacoes(),
    ],
    [
      'consequencias-indeferimento',
      'consequencia-indeferimento',
      () => api.listarConsequenciasDeIndeferimento(),
    ],
  ])('pede o vocabulário %s e devolve os rótulos da API', async (caminho, tipo, buscar) => {
    const resposta = firstValueFrom(buscar());
    const pedido = http.expectOne(`http://localhost:5000/api/selecao/vocabularios/${caminho}`);
    const opcoes = [{ codigo: 'CODIGO', rotulo: 'Rótulo da API' }];
    expect(pedido.request.method).toBe('GET');
    expect(pedido.request.headers.get('Accept')).toBe(buildVendorMimeAccept(tipo, 1));
    pedido.flush(opcoes);
    const resultado = await resposta;
    expect(isApiOk(resultado) && resultado.data).toEqual(opcoes);
  });
});
