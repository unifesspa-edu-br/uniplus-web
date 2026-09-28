import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ApiResult,
  apiResultInterceptor,
  buildVendorMimeAccept,
  isApiOk,
} from '@uniplus/shared-core/http';
import { AtoNormativoDto, AtosApi } from './atos.api';
import { PUBLICACOES_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';

const atoSeed: AtoNormativoDto = {
  id: '01960000-0000-7000-0000-0000000000b1',
  orgao: 'CEPS/Unifesspa',
  serie: 'Edital de Abertura',
  ano: 2026,
  numero: '001/2026',
  tipoCodigo: 'EDITAL_ABERTURA',
  congelaConfiguracao: true,
  efeitoIrreversivel: false,
  unicoPorObjeto: true,
  dataPublicacao: '2026-09-25',
  documentoHash: 'abc123',
  assinante: 'Reitor da Unifesspa',
  registradoEm: '2026-09-25T12:00:00Z',
  versaoInvocadaId: null,
  versaoInvocadaHash: null,
  atoRetificadoId: null,
  motivoRetificacao: null,
  avisos: null,
  _links: null,
};

describe('AtosApi', () => {
  let api: AtosApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: PUBLICACOES_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(AtosApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('obter() faz GET pelo identificador com Accept ato-normativo v1', async () => {
    const promise = firstValueFrom(api.obter(atoSeed.id));
    const req = controller.expectOne(`${BASE}/api/publicacoes/atos/${atoSeed.id}`);

    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('ato-normativo', 1));
    req.flush(atoSeed);

    const result = (await promise) as ApiResult<AtoNormativoDto>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) expect(result.data).toEqual(atoSeed);
  });
});
