import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor, buildVendorMimeAccept } from '@uniplus/shared-core/http';
import { withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { PerfisApi } from './perfis.api';
import { AUTORIZACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const RAIZ = `${BASE}/api/autorizacao/perfis`;
const ID = '01960000-0000-7000-0000-0000000000d1';

describe('PerfisApi', () => {
  let api: PerfisApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: AUTORIZACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(PerfisApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('lista perfis e o catálogo pelos vendor MIME próprios', () => {
    void firstValueFrom(api.listar());
    void firstValueFrom(api.catalogoDePermissoes());
    expect(controller.expectOne(`${RAIZ}?limit=50`).request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('perfil', 1),
    );
    expect(
      controller.expectOne(`${BASE}/api/autorizacao/permissoes`).request.headers.get('Accept'),
    ).toBe(buildVendorMimeAccept('permissao-catalogo', 1));
  });

  it('cria e atualiza com chave de idempotência', () => {
    const comando = { nome: 'Operador', descricao: 'Opera.', permissoes: ['a:b:c'] };
    void firstValueFrom(api.criar(comando, withIdempotencyKey('k1')));
    expect(controller.expectOne(RAIZ).request.method).toBe('POST');

    void firstValueFrom(api.atualizar(ID, { id: ID, ...comando }, withIdempotencyKey('k2')));
    const req = controller.expectOne(`${RAIZ}/${ID}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k2');
  });

  it('ativa por POST e desativa por DELETE na mesma rota', () => {
    void firstValueFrom(api.ativar(ID, withIdempotencyKey('k3')));
    void firstValueFrom(api.desativar(ID, withIdempotencyKey('k4')));
    const [ativar, desativar] = controller.match(`${RAIZ}/${ID}/ativacao`);
    expect(ativar?.request.method).toBe('POST');
    expect(desativar?.request.method).toBe('DELETE');
  });
});
