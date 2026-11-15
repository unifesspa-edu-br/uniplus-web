import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor, buildVendorMimeAccept, isApiOk } from '@uniplus/shared-core/http';
import { TipoConceitoDto, TiposConceitoApi } from './tipos-conceito.api';
import { CONFIGURACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';

const aprovacao: TipoConceitoDto = {
  id: '01960000-0000-7000-0000-0000000000c1',
  codigo: 'RESULTADO_DA_ANALISE',
  nome: 'Resultado da análise',
  descricao: null,
  natureza: 'categorico',
  ativo: true,
  numerico: null,
  valores: [{ codigo: 'APTO', rotulo: 'Apto', contaComoAprovacao: true }],
};

describe('TiposConceitoApi', () => {
  let api: TiposConceitoApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(TiposConceitoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('listar() faz GET com limit e Accept tipo-conceito v1', async () => {
    const promise = firstValueFrom(api.listar({ limit: 100 }));
    const req = controller.expectOne(`${BASE}/api/configuracao/tipos-conceito?limit=100`);

    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('tipo-conceito', 1));
    req.flush([aprovacao]);

    const result = await promise;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) expect(result.data).toEqual([aprovacao]);
  });

  it('listar() repassa o cursor opaco sem decodificá-lo', async () => {
    const cursor = 'aes-gcm:V2l0aCtwbHVzL3NpZ25zPT0=';
    const promise = firstValueFrom(api.listar({ cursor, direction: 'next' }));
    const req = controller.expectOne(
      (request) => request.url === `${BASE}/api/configuracao/tipos-conceito`,
    );

    expect(req.request.params.get('cursor')).toBe(cursor);
    expect(req.request.params.get('direction')).toBe('next');
    req.flush([aprovacao]);
    await promise;
  });
});
