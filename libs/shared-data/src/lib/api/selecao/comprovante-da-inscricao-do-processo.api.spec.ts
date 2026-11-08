import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor, buildVendorMimeAccept } from '@uniplus/shared-core/http';

import { ComprovanteDaInscricaoDoProcessoApi } from './comprovante-da-inscricao-do-processo.api';
import { SELECAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';

describe('ComprovanteDaInscricaoDoProcessoApi', () => {
  let controller: HttpTestingController;
  let api: ComprovanteDaInscricaoDoProcessoApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(ComprovanteDaInscricaoDoProcessoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('pede o comprovante pela rota da inscrição do processo, com o media type dele', async () => {
    const promessa = firstValueFrom(api.obter('p-1', 'i-1', 2));

    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/p-1/inscricoes/i-1/comprovantes/2`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('comprovante-inscricao', 1),
    );
    req.flush({ numero: 2 });

    const resultado = await promessa;
    expect(resultado.ok && resultado.data.numero).toBe(2);
  });

  it('entrega a recusa 403 como falha, sem lançar', async () => {
    const promessa = firstValueFrom(api.obter('p-1', 'i-1', 1));

    controller
      .expectOne(`${BASE}/api/selecao/processos-seletivos/p-1/inscricoes/i-1/comprovantes/1`)
      .flush(
        { type: 'about:blank', title: 'Acesso negado', status: 403, code: 'x' },
        { status: 403, statusText: 'Forbidden' },
      );

    const resultado = await promessa;
    expect(resultado.ok).toBe(false);
    expect(!resultado.ok && resultado.problem.status).toBe(403);
  });
});
