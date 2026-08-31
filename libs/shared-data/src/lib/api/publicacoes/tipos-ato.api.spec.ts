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
import { TipoAtoPublicadoDto, TiposAtoApi } from './tipos-ato.api';
import { PUBLICACOES_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';

const atoSeed: TipoAtoPublicadoDto = {
  id: '01960000-0000-7000-0000-0000000000a1',
  codigo: 'RESULTADO_HOMOLOGACAO',
  nome: 'Resultado da homologação das inscrições',
  congelaConfiguracao: false,
  unicoPorObjeto: false,
  efeitoIrreversivel: false,
  vigenciaInicio: '2020-01-01',
  vigenciaFim: null,
  baseLegal: null,
  criadoEm: '2026-08-30T12:00:00Z',
};

describe('TiposAtoApi', () => {
  let api: TiposAtoApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: PUBLICACOES_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(TiposAtoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('listar() faz GET com limit e Accept tipo-ato v1', async () => {
    const promise = firstValueFrom(api.listar({ limit: 50 }));
    const req = controller.expectOne(`${BASE}/api/publicacoes/tipos-ato?limit=50`);

    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('tipo-ato', 1));
    req.flush([atoSeed]);

    const result = (await promise) as ApiResult<readonly TipoAtoPublicadoDto[]>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) expect(result.data).toEqual([atoSeed]);
  });

  it('listar() repassa o cursor opaco sem decodificá-lo', async () => {
    const cursor = 'aes-gcm:V2l0aCtwbHVzL3NpZ25zPT0=';
    const promise = firstValueFrom(api.listar({ cursor, direction: 'prev' }));
    const req = controller.expectOne(
      (request) => request.url === `${BASE}/api/publicacoes/tipos-ato`,
    );

    expect(req.request.params.get('cursor')).toBe(cursor);
    expect(req.request.params.get('direction')).toBe('prev');
    expect(req.request.params.has('limit')).toBe(false);
    req.flush([atoSeed]);
    await promise;
  });

  /**
   * O cliente repassa a escolha em vez de impor uma. Omitido, o parâmetro não
   * viaja e vale o padrão do servidor — que é `true`, só as vigentes. Quem
   * precisa da série histórica declara `false`, e é esse o caminho de quem vai
   * resolver o rótulo de um código já gravado cuja versão encerrou.
   */
  it('listar() só envia vigentes quando o filtro é declarado', async () => {
    const semFiltro = firstValueFrom(api.listar());
    const reqSemFiltro = controller.expectOne(
      (request) => request.url === `${BASE}/api/publicacoes/tipos-ato`,
    );
    expect(reqSemFiltro.request.params.has('vigentes')).toBe(false);
    reqSemFiltro.flush([atoSeed]);
    await semFiltro;

    const comFiltro = firstValueFrom(api.listar({ vigentes: true }));
    const reqComFiltro = controller.expectOne(
      (request) => request.url === `${BASE}/api/publicacoes/tipos-ato`,
    );
    expect(reqComFiltro.request.params.get('vigentes')).toBe('true');
    reqComFiltro.flush([atoSeed]);
    await comFiltro;
  });

  /**
   * `false` precisa chegar ao servidor como `false`, e não sumir junto com o
   * caso omitido: é o único caminho para a série histórica, e é o que resolve o
   * rótulo de um ato referenciado cuja versão encerrou. Um `if (query.vigentes)`
   * no lugar da checagem por `undefined` passaria em todo o resto da suíte e
   * quebraria exatamente aqui.
   */
  it('listar() envia vigentes=false, que é o caminho da série histórica', async () => {
    const promise = firstValueFrom(api.listar({ vigentes: false }));
    const req = controller.expectOne(
      (request) => request.url === `${BASE}/api/publicacoes/tipos-ato`,
    );

    expect(req.request.params.get('vigentes')).toBe('false');
    req.flush([atoSeed]);
    await promise;
  });

  it('obterVigente() escapa o código na URL e omite data quando não informada', async () => {
    const promise = firstValueFrom(api.obterVigente('RESULTADO/HOMOLOGACAO'));
    const req = controller.expectOne(
      (request) =>
        request.url === `${BASE}/api/publicacoes/tipos-ato/RESULTADO%2FHOMOLOGACAO/vigente`,
    );

    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('data')).toBe(false);
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('tipo-ato', 1));
    req.flush(atoSeed);

    const result = (await promise) as ApiResult<TipoAtoPublicadoDto>;
    expect(isApiOk(result)).toBe(true);
  });

  it('obterVigente() envia a data quando informada', async () => {
    const promise = firstValueFrom(api.obterVigente('RESULTADO_FINAL', '2026-03-01'));
    const req = controller.expectOne(
      (request) => request.url === `${BASE}/api/publicacoes/tipos-ato/RESULTADO_FINAL/vigente`,
    );

    expect(req.request.params.get('data')).toBe('2026-03-01');
    req.flush(atoSeed);
    await promise;
  });

  /**
   * A recusa chega envelopada como `ProblemDetails`, e é ela que a tela do
   * cronograma usa para dizer que o ato declarado não tem versão vigente.
   */
  it('propaga ProblemDetails sem lançar', async () => {
    const promise = firstValueFrom(api.obterVigente('INEXISTENTE'));
    const req = controller.expectOne(
      (request) => request.url === `${BASE}/api/publicacoes/tipos-ato/INEXISTENTE/vigente`,
    );

    req.flush(
      {
        type: 'https://unifesspa-edu-br.github.io/uniplus-developers/erros/uniplus.publicacoes.tipo_ato.nao_encontrado',
        title: 'Tipo de ato não encontrado',
        status: 404,
        code: 'uniplus.publicacoes.tipo_ato.nao_encontrado',
        traceId: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      },
      { status: 404, statusText: 'Not Found' },
    );

    const result = (await promise) as ApiResult<TipoAtoPublicadoDto>;
    expect(isApiOk(result)).toBe(false);
    if (!result.ok) expect(result.problem.status).toBe(404);
  });
});
