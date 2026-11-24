import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, type Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  apiResultInterceptor,
  buildVendorMimeAccept,
  isApiOk,
  type ApiResult,
} from '@uniplus/shared-core/http';
import { SELECAO_BASE_PATH } from './tokens';
import { VocabulariosDaDeliberacaoApi } from './vocabularios-da-deliberacao.api';

describe('VocabulariosDaDeliberacaoApi', () => {
  let api: VocabulariosDaDeliberacaoApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: 'http://localhost:5000' },
      ],
    });
    api = TestBed.inject(VocabulariosDaDeliberacaoApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const casos: [
    string,
    string,
    () => Observable<ApiResult<readonly { codigo: string; rotulo: string }[]>>,
  ][] = [
    ['modos-deliberacao', 'modo-deliberacao', () => api.listarModosDeDeliberacao()],
    ['criterios-votacao', 'criterio-votacao', () => api.listarCriteriosDeVotacao()],
    ['desempates-votacao', 'desempate-votacao', () => api.listarDesempatesDaVotacao()],
    ['encerramentos-votacao', 'encerramento-votacao', () => api.listarEncerramentosDaVotacao()],
    [
      'resultados-sem-unanimidade',
      'resultado-sem-unanimidade',
      () => api.listarResultadosSemUnanimidade(),
    ],
  ];

  it.each(casos)('pede %s e devolve o rótulo da API', async (caminho, tipo, buscar) => {
    const resposta = firstValueFrom(buscar());
    const pedido = http.expectOne(`http://localhost:5000/api/selecao/vocabularios/${caminho}`);
    const opcoes = [{ codigo: 'codigo', rotulo: 'Rótulo da API' }];
    expect(pedido.request.method).toBe('GET');
    expect(pedido.request.headers.get('Accept')).toBe(buildVendorMimeAccept(tipo, 1));
    pedido.flush(opcoes);
    const resultado = await resposta;
    expect(isApiOk(resultado) && resultado.data).toEqual(opcoes);
  });
});
