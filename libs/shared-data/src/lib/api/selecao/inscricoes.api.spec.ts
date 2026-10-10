import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor, buildVendorMimeAccept } from '@uniplus/shared-core/http';
import { withIdempotencyKey } from '@uniplus/shared-core/idempotency';

import { InscricoesApi } from './inscricoes.api';
import type { InscricaoRequest } from './inscricoes.contrato';
import { SELECAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const PROCESSO = '0199e000-0000-7000-8000-0000000000d1';
const ROTA = `${BASE}/api/selecao/processos-seletivos/${PROCESSO}/inscricao`;
const ETAG = '"inscricao-1:3"';
const REQUEST: InscricaoRequest = { ofertaCursoId: null, respostas: {}, grupos: null, aceites: [] };

describe('InscricoesApi', () => {
  let api: InscricoesApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(InscricoesApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('salva o rascunho com o ETag no If-Match', async () => {
    const promessa = firstValueFrom(api.salvar(PROCESSO, REQUEST, ETAG));

    const req = controller.expectOne(ROTA);
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('If-Match')).toBe(ETAG);
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('inscricao', 1));
    req.flush({});
    await promessa;
  });

  it('envia com o If-Match, a Idempotency-Key de quem chama e o media type do comprovante', async () => {
    const promessa = firstValueFrom(
      api.submeter(PROCESSO, REQUEST, ETAG, withIdempotencyKey('envio-1')),
    );

    const req = controller.expectOne(`${ROTA}/submissao`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('If-Match')).toBe(ETAG);
    expect(req.request.headers.get('Idempotency-Key')).toBe('envio-1');
    expect(req.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('comprovante-inscricao', 1),
    );
    req.flush({});
    await promessa;
  });
  it('lê o comprovante pela ordem da submissão e as inscrições do dono, com o media type de cada um', async () => {
    const comprovante = firstValueFrom(api.obterComprovante(PROCESSO, 2));
    const minhas = firstValueFrom(api.minhas());

    const reqComprovante = controller.expectOne(`${ROTA}/comprovantes/2`);
    expect(reqComprovante.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('comprovante-inscricao', 1),
    );
    const reqMinhas = controller.expectOne(`${BASE}/api/selecao/minhas-inscricoes`);
    expect(reqMinhas.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('minhas-inscricoes', 1),
    );
    reqComprovante.flush({});
    reqMinhas.flush([]);
    await Promise.all([comprovante, minhas]);
  });
});
