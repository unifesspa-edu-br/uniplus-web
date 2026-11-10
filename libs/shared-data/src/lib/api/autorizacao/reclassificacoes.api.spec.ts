import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { ReclassificacoesApi } from './reclassificacoes.api';
import { AUTORIZACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-0000000000e1';

describe('ReclassificacoesApi', () => {
  let api: ReclassificacoesApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: AUTORIZACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(ReclassificacoesApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('decide a etapa por POST em decisoes, com chave de idempotência', () => {
    const corpo = {
      etapa: 'protecao_de_dados',
      resultado: 'mantida',
      concessoes: null,
      todas: true,
      motivo: 'Aguarda esclarecimento.',
    };
    void firstValueFrom(api.decidir(ID, corpo, withIdempotencyKey('k1')));
    const req = controller.expectOne(`${BASE}/api/autorizacao/reclassificacoes/${ID}/decisoes`);

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(corpo);
    expect(req.request.headers.get('Idempotency-Key')).toBe('k1');
    req.flush({ loteId: ID, decididas: [], liberadas: [], paraOutraPessoa: [], puladasPorEscopo: [] });
  });
});
