import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { ProvidenciasApi } from './providencias.api';
import { AUTORIZACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const ROTA = `${BASE}/api/autorizacao/providencias`;
const ID = '01960000-0000-7000-0000-0000000000e1';

describe('ProvidenciasApi', () => {
  let api: ProvidenciasApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: AUTORIZACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(ProvidenciasApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('solicita com a concessão, o tipo e o fundamento, sob a chave de idempotência', () => {
    const corpo = { concessaoId: ID, tipo: 'retirada', fundamento: 'Deixou a banca.' } as const;
    void firstValueFrom(api.solicitar(corpo, withIdempotencyKey('k')));
    const req = controller.expectOne(ROTA);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(corpo);
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    req.flush({});
  });

  it('responde com o motivo na rota da resposta', () => {
    void firstValueFrom(api.responder(ID, { motivo: 'Mantido.' }, withIdempotencyKey('k')));
    const req = controller.expectOne(`${ROTA}/${ID}/resposta`);
    expect(req.request.body).toEqual({ motivo: 'Mantido.' });
    req.flush({});
  });

  it('atende com o motivo e o e-mail do beneficiário na rota do atendimento', () => {
    const corpo = { motivo: 'Retirado.', confirmacaoEmail: 'leandro-viana84@agenciadbd.com' };
    void firstValueFrom(api.atender(ID, corpo, withIdempotencyKey('k')));
    const req = controller.expectOne(`${ROTA}/${ID}/atendimento`);
    expect(req.request.body).toEqual(corpo);
    req.flush({});
  });
});
