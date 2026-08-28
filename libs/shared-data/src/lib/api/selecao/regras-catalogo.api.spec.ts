import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor, buildVendorMimeAccept, isApiOk } from '@uniplus/shared-core/http';

import { RegraCatalogoDto, RegrasCatalogoApi } from './regras-catalogo.api';
import { SELECAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const ROTA = `${BASE}/api/selecao/regras-catalogo`;
const ACCEPT = buildVendorMimeAccept('regra-catalogo', 1);

const regra: RegraCatalogoDto = {
  codigo: 'LEI_12711_2012',
  versao: '2024.1',
  tipo: 'DISTRIBUICAO',
  esquemaArgs: {},
  invariantes: {},
  baseLegal: 'Lei nº 12.711/2012',
  hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
};

describe('RegrasCatalogoApi', () => {
  let api: RegrasCatalogoApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });

    api = TestBed.inject(RegrasCatalogoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  describe('listar', () => {
    it('pede a primeira página com o limite padrão e o vendor MIME da versão', async () => {
      const promessa = firstValueFrom(api.listar());

      const req = controller.expectOne((r) => r.url === ROTA);
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Accept')).toBe(ACCEPT);
      expect(req.request.params.get('limit')).toBe('100');
      expect(req.request.params.has('cursor')).toBe(false);

      req.flush([regra]);
      const resultado = await promessa;
      expect(isApiOk(resultado) && resultado.data).toEqual([regra]);
    });

    it('respeita o limite informado', async () => {
      const promessa = firstValueFrom(api.listar({ limit: 25 }));

      const req = controller.expectOne((r) => r.url === ROTA);
      expect(req.request.params.get('limit')).toBe('25');

      req.flush([]);
      await promessa;
    });

    it('propaga o filtro por tipo', async () => {
      const promessa = firstValueFrom(api.listar({ tipo: 'DISTRIBUICAO' }));

      const req = controller.expectOne((r) => r.url === ROTA);
      expect(req.request.params.get('tipo')).toBe('DISTRIBUICAO');

      req.flush([regra]);
      await promessa;
    });

    /**
     * O filtro precisa sobreviver à navegação: sem ele na segunda página, o
     * operador que filtrou por tipo receberia o catálogo inteiro ao avançar.
     */
    it('mantém o filtro ao navegar por cursor', async () => {
      const promessa = firstValueFrom(
        api.listar({ tipo: 'AJUSTE', cursor: 'oQ==', direction: 'prev' }),
      );

      const req = controller.expectOne((r) => r.url === ROTA);
      expect(req.request.params.get('tipo')).toBe('AJUSTE');
      expect(req.request.params.get('cursor')).toBe('oQ==');
      expect(req.request.params.get('direction')).toBe('prev');
      expect(req.request.params.has('limit')).toBe(false);

      req.flush([]);
      await promessa;
    });

    it('avança por padrão quando o cursor vem sem direção', async () => {
      const promessa = firstValueFrom(api.listar({ cursor: 'oQ==' }));

      const req = controller.expectOne((r) => r.url === ROTA);
      expect(req.request.params.get('direction')).toBe('next');

      req.flush([]);
      await promessa;
    });

    /** Cursor vazio é ausência de cursor, não uma página de nome vazio. */
    it('trata cursor vazio como primeira página', async () => {
      const promessa = firstValueFrom(api.listar({ cursor: '' }));

      const req = controller.expectOne((r) => r.url === ROTA);
      expect(req.request.params.get('limit')).toBe('100');
      expect(req.request.params.has('cursor')).toBe(false);

      req.flush([]);
      await promessa;
    });
  });

  describe('obterVersao', () => {
    it('busca a versão pedida com o vendor MIME da versão', async () => {
      const promessa = firstValueFrom(api.obterVersao('LEI_12711_2012', '2024.1'));

      const req = controller.expectOne(`${ROTA}/LEI_12711_2012/versoes/2024.1`);
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Accept')).toBe(ACCEPT);

      req.flush(regra);
      const resultado = await promessa;
      expect(isApiOk(resultado) && resultado.data).toEqual(regra);
    });

    /** Código e versão são texto livre no contrato, não identificadores opacos. */
    it('escapa os segmentos de caminho', async () => {
      const promessa = firstValueFrom(api.obterVersao('REGRA/COM BARRA', '2024.1+rev'));

      controller
        .expectOne(`${ROTA}/REGRA%2FCOM%20BARRA/versoes/2024.1%2Brev`)
        .flush(regra);

      await promessa;
    });
  });

  /** Recusa da API vira resultado de erro; quem chama decide o que exibir. */
  it('entrega a recusa como resultado, sem lançar', async () => {
    const promessa = firstValueFrom(api.listar({ tipo: 'INEXISTENTE' }));

    controller.expectOne((r) => r.url === ROTA).flush(
      { type: 'about:blank', title: 'Tipo desconhecido', status: 422 },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    const resultado = await promessa;
    expect(isApiOk(resultado)).toBe(false);
  });
});
