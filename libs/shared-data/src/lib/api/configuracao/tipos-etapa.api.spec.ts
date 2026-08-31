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
import { TipoEtapaDto, TiposEtapaApi } from './tipos-etapa.api';
import { CONFIGURACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';

const provaObjetiva: TipoEtapaDto = {
  id: '01960000-0000-7000-0000-0000000000b1',
  codigo: 'PROVA_OBJETIVA',
  nome: 'Prova Objetiva',
  descricao: null,
  ativo: true,
  criadoEm: '2026-08-30T12:00:00Z',
};

const bancaAposentada: TipoEtapaDto = {
  ...provaObjetiva,
  id: '01960000-0000-7000-0000-0000000000b2',
  codigo: 'BANCA_HETEROIDENTIFICACAO',
  nome: 'Banca de Heteroidentificação',
  ativo: false,
};

describe('TiposEtapaApi', () => {
  let api: TiposEtapaApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(TiposEtapaApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('listar() faz GET com limit e Accept tipo-etapa v1', async () => {
    const promise = firstValueFrom(api.listar({ limit: 50 }));
    const req = controller.expectOne(`${BASE}/api/configuracao/tipos-etapa?limit=50`);

    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('tipo-etapa', 1));
    req.flush([provaObjetiva]);

    const result = (await promise) as ApiResult<readonly TipoEtapaDto[]>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) expect(result.data).toEqual([provaObjetiva]);
  });

  it('listar() repassa o cursor opaco sem decodificá-lo', async () => {
    const cursor = 'aes-gcm:V2l0aCtwbHVzL3NpZ25zPT0=';
    const promise = firstValueFrom(api.listar({ cursor, direction: 'prev' }));
    const req = controller.expectOne(
      (request) => request.url === `${BASE}/api/configuracao/tipos-etapa`,
    );

    expect(req.request.params.get('cursor')).toBe(cursor);
    expect(req.request.params.get('direction')).toBe('prev');
    expect(req.request.params.has('limit')).toBe(false);
    req.flush([provaObjetiva]);
    await promise;
  });

  /**
   * O endpoint não filtra por atividade, e o cliente não pode inventar o filtro:
   * um tipo inativo já referenciado por uma etapa gravada precisa chegar à tela
   * para que o vínculo existente tenha rótulo. Quem separa o que é escolhível do
   * que é apenas exibível é o consumidor, pelo campo `ativo`.
   */
  it('listar() devolve ativos e inativos, sem filtrar por conta própria', async () => {
    const promise = firstValueFrom(api.listar());
    const req = controller.expectOne(
      (request) => request.url === `${BASE}/api/configuracao/tipos-etapa`,
    );

    expect(req.request.params.has('ativo')).toBe(false);
    expect(req.request.params.has('ativos')).toBe(false);
    req.flush([provaObjetiva, bancaAposentada]);

    const result = (await promise) as ApiResult<readonly TipoEtapaDto[]>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      expect(result.data.map((tipo) => tipo.ativo)).toEqual([true, false]);
    }
  });

  it('obter() escapa o id na URL', async () => {
    const promise = firstValueFrom(api.obter('id/com barra'));
    const req = controller.expectOne(
      (request) => request.url === `${BASE}/api/configuracao/tipos-etapa/id%2Fcom%20barra`,
    );

    expect(req.request.method).toBe('GET');
    req.flush(provaObjetiva);
    await promise;
  });

  it('propaga ProblemDetails sem lançar', async () => {
    const promise = firstValueFrom(api.obter(provaObjetiva.id));
    const req = controller.expectOne(
      (request) => request.url === `${BASE}/api/configuracao/tipos-etapa/${provaObjetiva.id}`,
    );

    req.flush(
      {
        type: 'https://unifesspa-edu-br.github.io/uniplus-developers/erros/uniplus.configuracao.tipo_etapa.nao_encontrado',
        title: 'Tipo de etapa não encontrado',
        status: 404,
        code: 'uniplus.configuracao.tipo_etapa.nao_encontrado',
        traceId: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      },
      { status: 404, statusText: 'Not Found' },
    );

    const result = (await promise) as ApiResult<TipoEtapaDto>;
    expect(isApiOk(result)).toBe(false);
    if (!result.ok) expect(result.problem.status).toBe(404);
  });
});
