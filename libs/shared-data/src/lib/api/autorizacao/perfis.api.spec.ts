import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
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

  it('cria o perfil com a primeira versão, sob chave de idempotência, e não tem mais o PUT', () => {
    const comando = {
      nome: 'Operador',
      descricao: 'Opera.',
      permissoes: ['a:b:c'],
      protocolo: 'P-1',
      tamanhoDoDocumento: 10,
    };
    void firstValueFrom(api.criar(comando, withIdempotencyKey('k1')));
    const req = controller.expectOne(RAIZ);

    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k1');
    expect('atualizar' in api).toBe(false);
  });

  it('lê o perfil pelo tipo de mídia versionado', () => {
    void firstValueFrom(api.obter(ID));
    const req = controller.expectOne(`${RAIZ}/${ID}`);

    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toContain('perfil');
  });

  it('remove permissões por POST em remocoes', () => {
    void firstValueFrom(
      api.remover(
        ID,
        { permissoes: ['a:b:c'], motivo: 'Excesso.', categoria: 'incidente' },
        withIdempotencyKey('k5'),
      ),
    );
    const req = controller.expectOne(`${RAIZ}/${ID}/remocoes`);

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      permissoes: ['a:b:c'],
      motivo: 'Excesso.',
      categoria: 'incidente',
    });
  });

  it('não tem mais as rotas de ativação', () => {
    expect('ativar' in api).toBe(false);
    expect('desativar' in api).toBe(false);
  });
});
