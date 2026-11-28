import { HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor, isApiOk } from '@uniplus/shared-core/http';
import { RetificacaoDoProcessoApi } from './retificacao-do-processo.api';
import { SELECAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-000000000515';
const ROTA = `${BASE}/api/selecao/processos-seletivos/${ID}/configuracao`;

describe('RetificacaoDoProcessoApi', () => {
  let api: RetificacaoDoProcessoApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(RetificacaoDoProcessoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('lê a versão vigente no tipo de mídia da configuração e devolve o ETag', async () => {
    const chamada = firstValueFrom(api.lerConfiguracaoDaVersao(ID));
    const req = controller.expectOne(ROTA);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(
      'application/vnd.uniplus.configuracao-de-processo-seletivo.v1+json',
    );
    req.flush({ chave: 'x' }, { headers: new HttpHeaders({ ETag: '"abc"' }) });
    const resultado = await chamada;
    expect(isApiOk(resultado) && resultado.headers.get('ETag')).toBe('"abc"');
  });

  it('pede a versão informada', async () => {
    const chamada = firstValueFrom(api.lerConfiguracaoDaVersao(ID, 3));
    const req = controller.expectOne(`${ROTA}?versao=3`);
    req.flush({});
    await chamada;
    expect(req.request.params.get('versao')).toBe('3');
  });
});
