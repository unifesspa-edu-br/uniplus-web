import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor, buildVendorMimeAccept, isApiOk } from '@uniplus/shared-core/http';
import { SELECAO_BASE_PATH } from './tokens';
import { VocabulariosDoPrazoEDaValidadeApi } from './vocabularios-do-prazo-e-da-validade.api';

describe('VocabulariosDoPrazoEDaValidadeApi', () => {
  let api: VocabulariosDoPrazoEDaValidadeApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: 'http://localhost:5000' },
      ],
    });
    api = TestBed.inject(VocabulariosDoPrazoEDaValidadeApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it.each([
    ['escolhas-prazo-emissao', 'escolha-prazo-emissao', () => api.listarEscolhasDoPrazoDeEmissao()],
    ['escolhas-validade', 'escolha-validade', () => api.listarEscolhasDaValidade()],
    ['unidades-prazo-emissao', 'unidade-prazo-emissao', () => api.listarUnidadesDoPrazoDeEmissao()],
    ['tipos-data-referencia', 'tipo-data-referencia', () => api.listarTiposDaDataDeReferencia()],
    [
      'efeitos-analise-documento',
      'efeito-analise-documento',
      () => api.listarEfeitosNaAnaliseDoDocumento(),
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
