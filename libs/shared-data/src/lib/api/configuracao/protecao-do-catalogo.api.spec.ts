import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor, buildVendorMimeAccept } from '@uniplus/shared-core/http';
import { withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { ProtecaoDoCatalogoApi } from './protecao-do-catalogo.api';
import { CONFIGURACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const URL = `${BASE}/api/configuracao/admin/protecao-do-catalogo`;
const ID = '01960000-0000-7000-0000-0000000000d2';

describe('ProtecaoDoCatalogoApi', () => {
  let api: ProtecaoDoCatalogoApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(ProtecaoDoCatalogoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('listar() filtra pela situação e pede o tipo de mídia versionado', async () => {
    const promise = firstValueFrom(api.listar('SOLICITADA'));
    const req = controller.expectOne((r) => r.url === URL);
    expect(req.request.params.get('situacao')).toBe('SOLICITADA');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('protecao-do-catalogo', 1));
    req.flush([]);
    await promise;
  });

  it('solicitar() envia todos os pendentes, sem corpo e com Idempotency-Key', async () => {
    const promise = firstValueFrom(api.solicitar(withIdempotencyKey('k')));
    const req = controller.expectOne(`${URL}/solicitacoes`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    req.flush({ tiposDeDocumento: 2, fatos: 0 });
    await promise;
  });

  it('decidir() leva a proteção conferida e a recomendação, com Idempotency-Key', async () => {
    const command = {
      cadastro: 'TIPO_DOCUMENTO',
      itemId: ID,
      decisao: 'NEGADA',
      classificacaoProtecao: 'INTERNO',
      hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
      finalidadeTratamento: 'Conferir o laudo.',
      classificacaoRecomendada: 'SENSIVEL',
    };
    const promise = firstValueFrom(api.decidir(command, withIdempotencyKey('k')));
    const req = controller.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(command);
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await promise;
  });
});
