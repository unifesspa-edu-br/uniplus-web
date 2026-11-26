import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { buscaDeMunicipiosNoGeo } from './busca-de-municipios';
import { GEO_BASE_PATH } from './tokens';

describe('buscaDeMunicipiosNoGeo', () => {
  let controller: HttpTestingController;
  let buscar: ReturnType<typeof buscaDeMunicipiosNoGeo>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: GEO_BASE_PATH, useValue: 'http://localhost:5000' },
      ],
    });
    controller = TestBed.inject(HttpTestingController);
    buscar = TestBed.runInInjectionContext(buscaDeMunicipiosNoGeo);
  });

  afterEach(() => controller.verify());

  it('consulta o Geo com termo de 256 caracteres', async () => {
    const termo = 'a'.repeat(256);
    const resultado = firstValueFrom(buscar(termo, 'PA'));
    const requisicao = controller.expectOne((req) => req.url.endsWith('/api/cidades'));
    expect(requisicao.request.params.get('q')).toBe(termo);
    expect(requisicao.request.params.get('uf')).toBe('PA');
    expect(requisicao.request.params.get('limit')).toBe('20');
    requisicao.flush([]);
    expect(await resultado).toMatchObject({ ok: true, data: [] });
  });

  it('devolve sucesso vazio sem consultar o Geo com termo de 257 caracteres', async () => {
    const resultado = await firstValueFrom(buscar('a'.repeat(257)));
    expect(resultado).toMatchObject({ ok: true, data: [], status: 200 });
    controller.expectNone((req) => req.url.endsWith('/api/cidades'));
  });
});
