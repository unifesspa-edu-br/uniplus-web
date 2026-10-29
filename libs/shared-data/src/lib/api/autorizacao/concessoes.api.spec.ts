import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor, buildVendorMimeAccept } from '@uniplus/shared-core/http';
import { withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { ConcessoesApi } from './concessoes.api';
import { AUTORIZACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-0000000000c1';

describe('ConcessoesApi', () => {
  let api: ConcessoesApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: AUTORIZACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(ConcessoesApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('lista pela situação pedida', () => {
    void firstValueFrom(api.listar({ situacao: 'todas' }));
    const req = controller.expectOne(`${BASE}/api/autorizacao/concessoes?situacao=todas&limit=50`);
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('concessao', 1));
    req.flush([]);
  });

  it('lê a trilha da concessão', () => {
    void firstValueFrom(api.trilha(ID));
    const req = controller.expectOne(`${BASE}/api/autorizacao/concessoes/${ID}/trilha`);
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('trilha-da-concessao', 1));
    req.flush([]);
  });

  it('revoga com motivo, e-mail de confirmação e chave de idempotência', () => {
    const corpo = { motivo: 'Mudou de unidade.', confirmacaoEmail: 'betina@uniplus-test.local' };
    void firstValueFrom(api.revogar(ID, corpo, withIdempotencyKey('k')));
    const req = controller.expectOne(`${BASE}/api/autorizacao/concessoes/${ID}/revogacao`);
    expect(req.request.body).toEqual(corpo);
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});
