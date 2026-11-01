import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor, buildVendorMimeAccept } from '@uniplus/shared-core/http';

import { ArquivosDaInscricaoDoProcessoApi } from './arquivos-da-inscricao-do-processo.api';
import { SELECAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';

describe('ArquivosDaInscricaoDoProcessoApi', () => {
  let controller: HttpTestingController;
  let api: ArquivosDaInscricaoDoProcessoApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(ArquivosDaInscricaoDoProcessoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('pede o acesso do arquivo pela rota da inscrição do processo', async () => {
    const promessa = firstValueFrom(api.obterAcesso('p-1', 'i-1', 'a-1'));

    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/p-1/inscricoes/i-1/documentos/arquivos/a-1/acesso`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('acesso-arquivo-da-inscricao', 1),
    );
    req.flush({ url: 'https://armazenamento/arquivo', expiraEm: '2026-12-10T15:00:00Z' });

    const resultado = await promessa;
    expect(resultado.ok && resultado.data.url).toBe('https://armazenamento/arquivo');
  });
});
