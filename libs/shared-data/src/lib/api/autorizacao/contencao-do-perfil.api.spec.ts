import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { ContencaoDoPerfilApi } from './contencao-do-perfil.api';
import { AUTORIZACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const RAIZ = `${BASE}/api/autorizacao/perfis`;
const ID = '01960000-0000-7000-0000-0000000000d1';
const MOTIVO = { motivo: 'Incidente de segurança.' };

describe('ContencaoDoPerfilApi', () => {
  let api: ContencaoDoPerfilApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: AUTORIZACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(ContencaoDoPerfilApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it.each([
    ['suspender', 'suspensao'],
    ['desativar', 'desativacao'],
    ['reativar', 'reativacao'],
  ] as const)('%s envia o motivo em POST sob chave de idempotência', async (metodo, rota) => {
    const resposta = firstValueFrom(api[metodo](ID, MOTIVO, withIdempotencyKey('chave-1')));

    const req = controller.expectOne(`${RAIZ}/${ID}/${rota}`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(MOTIVO);
    expect(req.request.headers.get('Idempotency-Key')).toBe('chave-1');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect((await resposta).ok).toBe(true);
  });

  it('retoma uma etapa e devolve se a suspensão terminou e o que falta', async () => {
    const corpo = { etapa: 'gestao_de_acessos', motivo: 'Incidente resolvido.' };
    const resposta = firstValueFrom(api.retomar(ID, corpo, withIdempotencyKey('chave-2')));

    const req = controller.expectOne(`${RAIZ}/${ID}/suspensao/retomada`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(corpo);
    req.flush({ concluida: false, etapasPendentes: ['protecao_de_dados'] });
    const resultado = await resposta;
    expect(resultado.ok && resultado.data).toEqual({
      concluida: false,
      etapasPendentes: ['protecao_de_dados'],
    });
  });
});
