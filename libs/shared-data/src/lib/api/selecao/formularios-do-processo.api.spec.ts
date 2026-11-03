import {
  HttpContext,
  HttpContextToken,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  apiResultInterceptor,
  buildVendorMimeAccept,
  VENDOR_MIME_TOKEN,
} from '@uniplus/shared-core/http';
import { withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { SELECAO_BASE_PATH } from './tokens';
import { FormulariosDoProcessoApi } from './formularios-do-processo.api';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-000000000515';
const MODELO_ID = '01960000-0000-7000-0000-00000000051b';

describe('FormulariosDoProcessoApi', () => {
  let api: FormulariosDoProcessoApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(FormulariosDoProcessoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());
  it('obterFormularioRenderizavel() pede o formulário v2 da finalidade, rascunho incluído', async () => {
    const promise = firstValueFrom(api.obterFormularioRenderizavel(ID, 'INSCRICAO'));
    const req = controller.expectOne(
      `${BASE}/api/selecao/admin/processos-seletivos/${ID}/formularios/INSCRICAO/renderizavel`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(VENDOR_MIME_TOKEN)).toEqual({
      resource: 'formulario',
      version: 2,
    });
    req.flush({});
    await promise;
  });
  it('removerFormulario() entrega o contexto do chamador ao DELETE', async () => {
    const marca = new HttpContextToken<string>(() => '');
    const context = new HttpContext().set(marca, 'condicao-do-chamador');

    const promise = firstValueFrom(api.removerFormulario(ID, 'INSCRICAO', context));
    const req = controller.expectOne(
      `${BASE}/api/selecao/admin/processos-seletivos/${ID}/formularios/INSCRICAO`,
    );

    expect(req.request.method).toBe('DELETE');
    expect(req.request.context.get(marca)).toBe('condicao-do-chamador');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await promise;
  });
  it('aplicarModeloDeFormulario() preserva o contexto do chamador e acrescenta o vendor MIME', async () => {
    const marca = new HttpContextToken<string>(() => '');
    const context = withIdempotencyKey('chave-do-modelo').set(marca, 'condicao-do-chamador');

    const promise = firstValueFrom(
      api.aplicarModeloDeFormulario(ID, { modeloId: MODELO_ID }, context),
    );
    const req = controller.expectOne(
      `${BASE}/api/selecao/admin/processos-seletivos/${ID}/formularios/aplicacoes-de-modelo`,
    );

    expect(req.request.method).toBe('POST');
    expect(req.request.context.get(marca)).toBe('condicao-do-chamador');
    expect(req.request.headers.get('Idempotency-Key')).toBe('chave-do-modelo');
    expect(req.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('aplicacao-de-modelo-formulario', 1),
    );
    req.flush({});
    await promise;
  });
});
