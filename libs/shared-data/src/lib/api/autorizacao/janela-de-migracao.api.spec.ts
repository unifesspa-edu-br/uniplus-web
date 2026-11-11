import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { JanelaDeMigracaoApi } from './janela-de-migracao.api';
import { AUTORIZACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const PERFIL = '01960000-0000-7000-0000-0000000000d1';
const CONCESSAO = '01960000-0000-7000-0000-0000000000c1';
const JANELA = `${BASE}/api/autorizacao/perfis/${PERFIL}/janela`;

describe('JanelaDeMigracaoApi', () => {
  let api: JanelaDeMigracaoApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: AUTORIZACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(JanelaDeMigracaoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('envia o lote por POST em janela/lote, com chave de idempotência', () => {
    const corpo = {
      decisoes: [{ concessaoId: CONCESSAO, decisao: 'migrar' }],
      confirmacaoDeExclusao: false,
    };
    void firstValueFrom(api.enviarLote(PERFIL, corpo, withIdempotencyKey('k1')));
    const req = controller.expectOne(`${JANELA}/lote`);

    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k1');
    expect(req.request.body).toEqual(corpo);
  });

  it('decide a retida pela concessão, na rota das retidas', () => {
    const corpo = { decisao: 'recusar', confirmacaoDeExclusao: true };
    void firstValueFrom(api.decidirRetida(PERFIL, CONCESSAO, corpo, withIdempotencyKey('k2')));
    const req = controller.expectOne(`${JANELA}/retidas/${CONCESSAO}`);

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(corpo);
  });

  it('decide a etapa da proteção de dados e encerra a janela com o motivo', () => {
    const etapa = {
      decisoes: [{ concessaoId: CONCESSAO, decisao: 'recusar' }],
      confirmacaoDeExclusao: true,
    };
    const encerramento = { motivo: 'Versão anterior substituída.', confirmacaoDeExclusao: true };
    void firstValueFrom(api.decidirProtecaoDeDados(PERFIL, etapa, withIdempotencyKey('k3')));
    void firstValueFrom(api.encerrar(PERFIL, encerramento, withIdempotencyKey('k4')));

    expect(controller.expectOne(`${JANELA}/protecao-de-dados`).request.body).toEqual(etapa);
    expect(controller.expectOne(`${JANELA}/encerramento`).request.body).toEqual(encerramento);
  });
});
