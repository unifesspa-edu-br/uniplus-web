import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VENDOR_MIME_TOKEN, apiResultInterceptor } from '@uniplus/shared-core/http';
import { AvaliacoesDeFormularioApi } from './avaliacoes-de-formulario.api';
import { CONFIGURACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';

describe('AvaliacoesDeFormularioApi', () => {
  let api: AvaliacoesDeFormularioApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(AvaliacoesDeFormularioApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('avaliar() pede o media type da avaliação, sem Idempotency-Key por ser leitura', async () => {
    const promise = firstValueFrom(
      api.avaliar({
        regras: { etapas: [] },
        respostas: { IDADE: 18 },
        grupos: null,
        etapasConcluidas: null,
        pressupostos: null,
      }),
    );
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/avaliacoes-de-formulario`);
    expect(req.request.method).toBe('POST');
    expect(req.request.context.get(VENDOR_MIME_TOKEN)).toEqual({
      resource: 'avaliacao-de-formulario',
      version: 1,
    });
    expect(req.request.headers.has('Idempotency-Key')).toBe(false);
    expect(req.request.body.respostas).toEqual({ IDADE: 18 });
    req.flush({ etapas: [], campos: [], grupos: [], termos: [] });
    await promise;
  });
});
