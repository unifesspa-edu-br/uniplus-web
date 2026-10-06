import { HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable, firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  VENDOR_MIME_TOKEN,
  apiResultInterceptor,
  withIdempotencyKey,
} from '@uniplus/shared-core/http';
import { ModelosFormularioApi } from './modelos-formulario.api';
import { CONFIGURACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const ADMIN = `${BASE}/api/configuracao/admin/modelos-formulario`;
const ID = '01960000-0000-7000-0000-0000000000a1';

describe('ModelosFormularioApi', () => {
  let api: ModelosFormularioApi;
  let controller: HttpTestingController;
  const chave = (): HttpContext => withIdempotencyKey('k');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(ModelosFormularioApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  // A API recusa escrita sem Idempotency-Key, e o PUT e a ativação também a exigem.
  const escritas: readonly [string, () => Observable<unknown>, string, string][] = [
    ['criar', () => api.criar({} as never, chave()), 'POST', ADMIN],
    ['atualizar', () => api.atualizar(ID, {} as never, chave()), 'PUT', `${ADMIN}/${ID}`],
    ['ativar', () => api.ativar(ID, chave()), 'POST', `${ADMIN}/${ID}/ativacao`],
  ];

  it.each(escritas)('%s() envia a Idempotency-Key', async (_nome, chamar, metodo, url) => {
    const promise = firstValueFrom(chamar());
    const req = controller.expectOne(url);
    expect(req.request.method).toBe(metodo);
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await promise;
  });

  it('obter() pede o media type do modelo, sem o qual a API responde 406', async () => {
    const promise = firstValueFrom(api.obter(ID));
    const req = controller.expectOne(`${ADMIN}/${ID}`);
    expect(req.request.context.get(VENDOR_MIME_TOKEN)).toEqual({
      resource: 'modelo-formulario',
      version: 1,
    });
    req.flush({});
    await promise;
  });

  it('obterRenderizavel() pede o formulário v2 do modelo', async () => {
    const promise = firstValueFrom(api.obterRenderizavel(ID));
    const req = controller.expectOne(`${ADMIN}/${ID}/renderizavel`);
    expect(req.request.context.get(VENDOR_MIME_TOKEN)).toEqual({
      resource: 'formulario',
      version: 2,
    });
    req.flush({});
    await promise;
  });
});
