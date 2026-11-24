import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { INSCRICOES_DO_PROCESSO_ROUTES } from './inscricoes.routes';

import {
  BASE,
  INSCRICAO_ID,
  PROCESSO_ID,
  ROTA_DETALHE,
} from './detalhe-da-inscricao-dados.testing';

describe('rota do detalhe da inscrição', () => {
  it('recebe o processo e a inscrição pela URL, no acesso direto, e lê só o detalhe da inscrição', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'processo-seletivo/:id/inscricoes', children: INSCRICOES_DO_PROCESSO_ROUTES },
        ]),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });
    const controller = TestBed.inject(HttpTestingController);

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/processo-seletivo/${PROCESSO_ID}/inscricoes/${INSCRICAO_ID}`);
    await new Promise((resolve) => setTimeout(resolve));
    harness.detectChanges();

    expect(controller.expectOne(ROTA_DETALHE).request.method).toBe('GET');
    controller.expectNone((r) => r.url.includes('/certames/'));
    controller.expectNone(`${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/inscricoes`);
    controller.verify();
  });
});
