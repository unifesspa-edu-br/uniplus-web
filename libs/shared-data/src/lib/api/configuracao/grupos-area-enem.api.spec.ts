import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ApiResult,
  apiResultInterceptor,
  buildVendorMimeAccept,
  isApiOk,
} from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  GrupoAreaEnemDto,
  GruposAreaEnemApi,
} from '@uniplus/shared-data/configuracao';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const BASE = 'http://localhost:5000';

describe('GruposAreaEnemApi', () => {
  let api: GruposAreaEnemApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(GruposAreaEnemApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('listar() faz GET no vocabulário de grupos com Accept versionado e devolve a lista na ordem da API', async () => {
    const promise = firstValueFrom(api.listar());
    const req = controller.expectOne(
      (r) => r.url === `${BASE}/api/configuracao/vocabularios/grupos-area-enem`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('codigo-grupo-area-enem', 1),
    );
    // Conjunto fechado: a requisição não leva janela de paginação.
    expect(req.request.params.keys()).toEqual([]);
    req.flush([
      { codigo: 'TECNOLOGICA', rotulo: 'Tecnológica' },
      { codigo: 'HUMANISTICA_I', rotulo: 'Humanística I' },
    ]);
    const result = (await promise) as ApiResult<readonly GrupoAreaEnemDto[]>;
    expect(isApiOk(result)).toBe(true);
    expect(result.ok && result.data.map((grupo) => grupo.codigo)).toEqual([
      'TECNOLOGICA',
      'HUMANISTICA_I',
    ]);
  });
});
