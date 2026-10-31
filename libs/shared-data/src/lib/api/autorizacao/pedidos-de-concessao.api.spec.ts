import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor, buildVendorMimeAccept } from '@uniplus/shared-core/http';
import { withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { PedidosDeConcessaoApi } from './pedidos-de-concessao.api';
import { AUTORIZACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const RAIZ = `${BASE}/api/autorizacao/pedidos-de-concessao`;
const ID = '01960000-0000-7000-0000-0000000000a1';

describe('PedidosDeConcessaoApi', () => {
  let api: PedidosDeConcessaoApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: AUTORIZACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(PedidosDeConcessaoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('lista os perfis para pedir pelo vendor MIME próprio', async () => {
    const resposta = firstValueFrom(api.perfisParaPedir());
    const req = controller.expectOne(`${BASE}/api/autorizacao/perfis-para-pedido?limit=50`);
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('perfil-para-pedido', 1));
    req.flush([]);
    expect((await resposta).ok).toBe(true);
  });

  it('lista a fila pedida pelo vendor MIME do pedido', async () => {
    const resposta = firstValueFrom(api.listar({ fila: 'gestor', situacao: 'aguardando_gestor' }));
    const req = controller.expectOne(`${RAIZ}?fila=gestor&situacao=aguardando_gestor&limit=50`);
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('pedido-de-concessao', 1));
    req.flush([]);
    expect((await resposta).ok).toBe(true);
  });

  it('segue o cursor quando a página é pedida', () => {
    void firstValueFrom(api.listar({ cursor: 'abc', direction: 'prev' }));
    controller.expectOne(`${RAIZ}?cursor=abc&direction=prev`).flush([]);
  });

  it('cria o pedido com a chave de idempotência', () => {
    void firstValueFrom(
      api.criar(
        {
          beneficiarioEmail: null,
          perfilId: ID,
          unidadeId: ID,
          justificativa: 'Preciso do acesso.',
        },
        withIdempotencyKey('chave-1'),
      ),
    );
    const req = controller.expectOne(RAIZ);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('chave-1');
    req.flush({}, { status: 201, statusText: 'Created' });
  });

  it('recusa levando o motivo no corpo', () => {
    void firstValueFrom(
      api.recusar(ID, 'Sem necessidade funcional.', withIdempotencyKey('chave-2')),
    );
    const req = controller.expectOne(`${RAIZ}/${ID}/recusa`);
    expect(req.request.body).toEqual({ motivo: 'Sem necessidade funcional.' });
    req.flush({});
  });

  it('aprova e aceita sem corpo', () => {
    void firstValueFrom(api.aprovar(ID, withIdempotencyKey('chave-3')));
    void firstValueFrom(api.aceitar(ID, withIdempotencyKey('chave-4')));
    expect(controller.expectOne(`${RAIZ}/${ID}/aprovacoes`).request.body).toBeNull();
    expect(controller.expectOne(`${RAIZ}/${ID}/aceite`).request.body).toBeNull();
  });

  it('aprova levando o fim de vigência no corpo quando o gestor o define', () => {
    void firstValueFrom(
      api.aprovar(ID, withIdempotencyKey('chave-3b'), '2027-03-31T23:59:59-03:00'),
    );
    expect(controller.expectOne(`${RAIZ}/${ID}/aprovacoes`).request.body).toEqual({
      validaAte: '2027-03-31T23:59:59-03:00',
    });
  });

  it('cancela pelo DELETE do pedido', () => {
    void firstValueFrom(api.cancelar(ID));
    const req = controller.expectOne(`${RAIZ}/${ID}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('percorre o anexo: início, confirmação com o ETag e leitura', () => {
    const anexoId = '01960000-0000-7000-0000-0000000000b1';
    void firstValueFrom(api.iniciarAnexo(ID, 1024, withIdempotencyKey('chave-5')));
    expect(controller.expectOne(`${RAIZ}/${ID}/anexos`).request.body).toEqual({
      tamanhoDoPdf: 1024,
    });

    void firstValueFrom(api.confirmarAnexo(ID, anexoId, '"etag"', withIdempotencyKey('chave-6')));
    expect(
      controller.expectOne(`${RAIZ}/${ID}/anexos/${anexoId}/confirmacao`).request.body,
    ).toEqual({ etag: '"etag"' });

    void firstValueFrom(api.acessoAoAnexo(ID, anexoId));
    const leitura = controller.expectOne(`${RAIZ}/${ID}/anexos/${anexoId}`);
    expect(leitura.request.headers.get('Accept')).toBe(buildVendorMimeAccept('anexo-do-pedido', 1));
  });

  it('lê pedido e trilha pelos seus vendor MIME', () => {
    void firstValueFrom(api.obter(ID));
    void firstValueFrom(api.trilha(ID));
    expect(controller.expectOne(`${RAIZ}/${ID}`).request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('pedido-de-concessao', 1),
    );
    expect(controller.expectOne(`${RAIZ}/${ID}/trilha`).request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('trilha-do-pedido', 1),
    );
  });
});
