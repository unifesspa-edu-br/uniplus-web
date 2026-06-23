import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ApiResult,
  apiResultInterceptor,
  buildVendorMimeAccept,
  isApiFailure,
  isApiOk,
} from '@uniplus/shared-core/http';
import { CepResolvidoDto, CidadeResumoDto, GeoApi } from './geo.api';
import { GEO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';

const cepSeed: CepResolvidoDto = {
  cep: '68507590',
  tipo: 'logradouro',
  logradouro: 'Folha 31, Quadra 7',
  complemento: null,
  bairro: 'Nova Marabá',
  distrito: null,
  cidade: 'Marabá',
  codigoIbge: '1504208',
  uf: 'PA',
  latitude: '-5.368',
  longitude: '-49.118',
  nivelResolucao: 'logradouro',
  origem: 'geo-api',
};

const cidadesSeed: readonly CidadeResumoDto[] = [
  { id: '01960000-0000-7000-0000-0000000000c1', codigoIbge: '1504208', nome: 'Marabá', uf: 'PA', ddd: '94' },
  { id: '01960000-0000-7000-0000-0000000000c2', codigoIbge: '1505304', nome: 'Parauapebas', uf: 'PA', ddd: '94' },
];

describe('GeoApi', () => {
  let api: GeoApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: GEO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(GeoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('obterCep() faz GET /api/cep/{cep} normalizando a máscara e com Accept versionado', async () => {
    const promise = firstValueFrom(api.obterCep('68507-590'));

    const req = controller.expectOne(`${BASE}/api/cep/68507590`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('cep', 1));
    req.flush(cepSeed);

    const result = (await promise) as ApiResult<CepResolvidoDto>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) {
      expect(result.data.codigoIbge).toBe('1504208');
      expect(result.data.nivelResolucao).toBe('logradouro');
    }
  });

  it('obterCep() devolve ApiFailure com status 404 quando o CEP não existe', async () => {
    const promise = firstValueFrom(api.obterCep('00000000'));

    const req = controller.expectOne(`${BASE}/api/cep/00000000`);
    req.flush(null, { status: 404, statusText: 'Not Found' });

    const result = (await promise) as ApiResult<CepResolvidoDto>;
    expect(isApiFailure(result)).toBe(true);
    expect(result.status).toBe(404);
  });

  it('listarCidades() faz GET /api/cidades com uf/q/limit e Accept versionado', async () => {
    const promise = firstValueFrom(api.listarCidades({ uf: 'pa', q: 'mar', limit: 20 }));

    const req = controller.expectOne(
      (r) => r.url === `${BASE}/api/cidades`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('uf')).toBe('PA');
    expect(req.request.params.get('q')).toBe('mar');
    expect(req.request.params.get('limit')).toBe('20');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('cidade', 1));
    req.flush(cidadesSeed);

    const result = (await promise) as ApiResult<readonly CidadeResumoDto[]>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0]?.nome).toBe('Marabá');
    }
  });

  it('listarCidades() sem filtro não envia parâmetros opcionais', async () => {
    const promise = firstValueFrom(api.listarCidades());

    const req = controller.expectOne(`${BASE}/api/cidades`);
    expect(req.request.params.keys()).toHaveLength(0);
    req.flush(cidadesSeed);

    await promise;
  });
});
