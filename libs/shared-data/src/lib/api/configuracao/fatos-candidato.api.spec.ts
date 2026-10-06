import { HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable, firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor, withIdempotencyKey } from '@uniplus/shared-core/http';
import { FatosCandidatoApi } from './fatos-candidato.api';
import { CONFIGURACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const ADMIN = `${BASE}/api/configuracao/admin/fatos-candidato`;
const ID = '01960000-0000-7000-0000-0000000000f1';

describe('FatosCandidatoApi', () => {
  let api: FatosCandidatoApi;
  let controller: HttpTestingController;
  const chave = (): HttpContext => withIdempotencyKey('k');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(FatosCandidatoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  const escritas: readonly [string, () => Observable<unknown>, string, string][] = [
    ['criar', () => api.criar({} as never, chave()), 'POST', ADMIN],
    ['criarDerivado', () => api.criarDerivado({} as never, chave()), 'POST', `${ADMIN}/derivados`],
    ['criarAgregado', () => api.criarAgregado({} as never, chave()), 'POST', `${ADMIN}/agregados`],
    [
      'atualizarDescritivo',
      () => api.atualizarDescritivo(ID, { nome: 'N', descricao: null }, chave()),
      'PUT',
      `${ADMIN}/${ID}`,
    ],
    ['ativar', () => api.ativar(ID, chave()), 'POST', `${ADMIN}/${ID}/ativacao`],
    [
      'definirRegrasPadrao',
      () => api.definirRegrasPadrao(ID, { regras: [] }, chave()),
      'PUT',
      `${ADMIN}/${ID}/regras-padrao`,
    ],
    [
      'acrescentarValor',
      () => api.acrescentarValor(ID, { codigo: 'A', descricao: null, ordem: 0 }, chave()),
      'POST',
      `${ADMIN}/${ID}/valores`,
    ],
    [
      'reativarValor',
      () => api.reativarValor(ID, 'ATE 1/SM', chave()),
      'POST',
      `${ADMIN}/${ID}/valores/ATE%201%2FSM/ativacao`,
    ],
  ];

  it.each(escritas)(
    '%s() chama o endpoint de admin com a Idempotency-Key',
    async (_nome, chamar, metodo, url) => {
      const promise = firstValueFrom(chamar());
      const req = controller.expectOne(url);
      expect(req.request.method).toBe(metodo);
      expect(req.request.headers.get('Idempotency-Key')).toBe('k');
      req.flush(null, { status: 204, statusText: 'No Content' });
      await promise;
    },
  );

  it('desativarValor() codifica o código do valor no caminho', async () => {
    const promise = firstValueFrom(api.desativarValor(ID, 'ATE 1/SM'));
    const req = controller.expectOne(`${ADMIN}/${ID}/valores/ATE%201%2FSM`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await promise;
  });
});
