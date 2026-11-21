import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor, buildVendorMimeAccept, isApiOk } from '@uniplus/shared-core/http';
import { OpcoesDoRecursoApi } from './opcoes-do-recurso.api';
import { SELECAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';

describe('OpcoesDoRecursoApi', () => {
  let api: OpcoesDoRecursoApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(OpcoesDoRecursoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('listarUnidadesDePrazo() pede o vocabulário das unidades na versão 1', async () => {
    const promise = firstValueFrom(api.listarUnidadesDePrazo());
    const req = controller.expectOne(`${BASE}/api/selecao/unidades-do-prazo-de-recurso`);
    const unidades = [{ codigo: 'horas', rotulo: 'Horas' }];

    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('unidade-do-prazo-de-recurso', 1),
    );
    req.flush(unidades);

    const resultado = await promise;
    expect(isApiOk(resultado) && resultado.data).toEqual(unidades);
  });

  it('listarEfeitosSuspensivos() pede o vocabulário dos efeitos, com a explicação de cada um', async () => {
    const promise = firstValueFrom(api.listarEfeitosSuspensivos());
    const req = controller.expectOne(`${BASE}/api/selecao/efeitos-suspensivos`);
    const efeitos = [
      { codigo: 'semEfeitoSuspensivo', rotulo: 'Sem efeito suspensivo', descricao: 'Explicação.' },
    ];

    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('efeito-suspensivo', 1));
    req.flush(efeitos);

    const resultado = await promise;
    expect(isApiOk(resultado) && resultado.data).toEqual(efeitos);
  });

  it('listarGuardasDaVaga() pede o vocabulário das guardas, com a explicação de cada uma', async () => {
    const promise = firstValueFrom(api.listarGuardasDaVaga());
    const req = controller.expectOne(`${BASE}/api/selecao/guardas-da-vaga`);
    const guardas = [
      { codigo: 'naoGuarda', rotulo: 'Não guarda a vaga', descricao: 'Explicação.' },
    ];

    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('guarda-da-vaga', 1));
    req.flush(guardas);

    const resultado = await promise;
    expect(isApiOk(resultado) && resultado.data).toEqual(guardas);
  });
});
