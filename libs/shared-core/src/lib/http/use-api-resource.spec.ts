import {
  HttpContext,
  HttpContextToken,
  HttpInterceptorFn,
  HttpResourceRequest,
} from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { ApplicationRef, Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  baseProblem,
  CorpoDaResposta,
  Edital,
  InitDaResposta,
  PROBLEM_HEADERS,
  problemaDe,
  provedoresDeHttpComEnvelope,
} from './api-result.interceptor.testing';
import { ProblemDetails } from './problem-details';
import { useApiResource, UseApiResourceRef } from './use-api-resource';
import { withVendorMime } from './vendor-mime';

const URL_EDITAL = '/api/selecao/editais/edt-1';
const RESPOSTA_OK: InitDaResposta = { status: 200, statusText: 'OK' };
const RESPOSTA_NAO_ENCONTRADO: InitDaResposta = {
  status: 404,
  statusText: 'Not Found',
  headers: PROBLEM_HEADERS,
};
const RESPOSTA_NAO_PROCESSAVEL: InitDaResposta = {
  status: 422,
  statusText: 'Unprocessable Entity',
  headers: PROBLEM_HEADERS,
};
const LINK_PROXIMA_PAGINA = '</api/selecao/editais?cursor=ABC>; rel="next"';
const CONTEXTO_DO_CHAMADOR = new HttpContextToken<boolean>(() => false);

const problemaDeValidacao: ProblemDetails = {
  ...problemaDe(422, 'uniplus.validacao', 'Erro de validação'),
  errors: [{ field: 'titulo', code: 'Titulo.Vazio', message: 'Título obrigatório' }],
};

/**
 * Interceptor sintético que lança Error não-HttpErrorResponse ANTES do request
 * sair (caso real: interceptor de auth/logging/telemetria com bug síncrono). O
 * throw escapa do envelopamento do apiResultInterceptor, que só captura
 * HttpErrorResponse, e chega ao httpResource em status 'error', fazendo
 * `Resource.value()` lançar `ResourceValueError` se chamado sem guard.
 */
const interceptorQueLancaErroNaoHttp: HttpInterceptorFn = () => {
  throw new Error('synthetic non-HTTP failure (e.g. logging interceptor)');
};

/**
 * Arranjo de teste recomendado pelo Angular team para `httpResource`
 * (https://angular.dev/guide/http/http-resource):
 *
 * 1. `TestBed.tick()` dispara o effect interno do `httpResource` (que cria a
 *    request a partir do request signal).
 * 2. `controller.flush(...)` resolve a HttpClient call.
 * 3. `await appRef.whenStable()` propaga o valor para os signals do resource.
 *
 * Não é possível usar `fakeAsync`/`flushMicrotasks` porque essas APIs exigem
 * Zone.js e o Angular team explicitamente desabilita ambas no Vitest runner.
 */
function setup() {
  TestBed.configureTestingModule({ providers: provedoresDeHttpComEnvelope() });
  const appRef = TestBed.inject(ApplicationRef);
  const injector = TestBed.inject(Injector);
  return {
    controller: TestBed.inject(HttpTestingController),
    create: <T>(requestFn: () => string | HttpResourceRequest | undefined): UseApiResourceRef<T> =>
      TestBed.runInInjectionContext(() => useApiResource<T>(requestFn, { injector })),
    tickEffects: () => TestBed.tick(),
    stable: () => appRef.whenStable(),
  };
}

function esperarEnvelopeOk(resource: UseApiResourceRef<Edital>, esperado: Edital): void {
  expect(resource.data()).toEqual(esperado);
  expect(resource.problem()).toBeNull();
  expect(resource.isLoading()).toBe(false);
  expect(resource.status()).toBe('resolved');
  expect(resource.statusCode()).toBe(200);
  expect(resource.value()?.ok).toBe(true);
}

describe('useApiResource', () => {
  let env: ReturnType<typeof setup>;

  beforeEach(() => {
    env = setup();
  });

  afterEach(() => env.controller.verify());

  function iniciar<T>(
    requestFn: () => string | HttpResourceRequest | undefined,
  ): UseApiResourceRef<T> {
    const resource = env.create<T>(requestFn);
    env.tickEffects();
    return resource;
  }

  async function responder(
    url: string,
    corpo: CorpoDaResposta,
    init: InitDaResposta = RESPOSTA_OK,
  ): Promise<void> {
    env.controller.expectOne(url).flush(corpo, init);
    await env.stable();
  }

  it('carga inicial com URL string dispara GET e popula data() em 200', async () => {
    const resource = iniciar<Edital>(() => URL_EDITAL);
    expect(resource.isLoading()).toBe(true);
    expect(resource.data()).toBeNull();

    const seed: Edital = { id: 'edt-1', numero: 42 };
    await responder(URL_EDITAL, seed);

    esperarEnvelopeOk(resource, seed);
  });

  it('mudança reativa do URL cancela request anterior e dispara nova (race-cancellation nativa)', async () => {
    const id = signal('edt-1');
    const resource = iniciar<Edital>(() => `/api/selecao/editais/${id()}`);
    const reqAntiga = env.controller.expectOne(URL_EDITAL);
    expect(reqAntiga.cancelled).toBe(false);

    id.set('edt-2');
    env.tickEffects();
    // httpResource cancela a request anterior quando dependências reativas mudam.
    expect(reqAntiga.cancelled).toBe(true);

    await responder('/api/selecao/editais/edt-2', { id: 'edt-2', numero: 99 });
    expect(resource.data()).toEqual({ id: 'edt-2', numero: 99 });
  });

  it('404 problem+json popula problem() e mantém data()=null', async () => {
    const resource = iniciar<Edital>(() => '/api/selecao/editais/missing');
    await responder('/api/selecao/editais/missing', baseProblem, RESPOSTA_NAO_ENCONTRADO);

    expect(resource.data()).toBeNull();
    expect(resource.problem()).toMatchObject({
      code: 'uniplus.selecao.edital.nao_encontrado',
      status: 404,
    });
    expect(resource.value()?.ok).toBe(false);
    // O interceptor envelopa o erro em ApiResult.fail: status resolved e error() indefinido.
    expect(resource.status()).toBe('resolved');
    expect(resource.error()).toBeUndefined();
  });

  it('network error (status 0) é envelopado como ApiFailure com code uniplus.client.network_error', async () => {
    const resource = iniciar<Edital>(() => URL_EDITAL);

    env.controller
      .expectOne(URL_EDITAL)
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await env.stable();

    expect(resource.data()).toBeNull();
    expect(resource.problem()?.code).toBe('uniplus.client.network_error');
    expect(resource.problem()?.status).toBe(0);
  });

  it('reload() refaz a request preservando dependências reativas atuais', async () => {
    const resource = iniciar<Edital>(() => URL_EDITAL);
    await responder(URL_EDITAL, { id: 'edt-1', numero: 1 });
    expect(resource.data()).toEqual({ id: 'edt-1', numero: 1 });

    resource.reload();
    env.tickEffects();
    await responder(URL_EDITAL, { id: 'edt-1', numero: 2 });

    expect(resource.data()).toEqual({ id: 'edt-1', numero: 2 });
  });

  it('request() retorna undefined => nenhum GET disparado, status=idle', async () => {
    const ativo = signal(false);
    const resource = iniciar<Edital>(() => (ativo() ? URL_EDITAL : undefined));

    expect(resource.status()).toBe('idle');
    expect(resource.data()).toBeNull();
    expect(resource.value()).toBeUndefined();
    // controller.verify() no afterEach garante que nenhuma request foi disparada.

    ativo.set(true);
    env.tickEffects();
    await responder(URL_EDITAL, { id: 'edt-1', numero: 7 });

    expect(resource.data()).toEqual({ id: 'edt-1', numero: 7 });
  });

  it('aceita HttpResourceRequest com context (compõe withVendorMime no Accept)', async () => {
    const resource = iniciar<Edital>(() => ({
      url: URL_EDITAL,
      context: withVendorMime('edital', 1),
    }));

    const req = env.controller.expectOne(URL_EDITAL);
    expect(req.request.headers.get('Accept')).toBe('application/vnd.uniplus.edital.v1+json');

    req.flush({ id: 'edt-1', numero: 42 }, RESPOSTA_OK);
    await env.stable();

    expect(resource.data()?.id).toBe('edt-1');
  });

  it('aceita HttpResourceRequest com context arbitrário (não amarrado a vendorMime)', async () => {
    const resource = iniciar<Edital>(() => ({
      url: URL_EDITAL,
      context: new HttpContext().set(CONTEXTO_DO_CHAMADOR, true),
    }));

    const req = env.controller.expectOne(URL_EDITAL);
    expect(req.request.context.get(CONTEXTO_DO_CHAMADOR)).toBe(true);
    req.flush({ id: 'edt-1', numero: 1 }, RESPOSTA_OK);
    await env.stable();

    expect(resource.data()?.numero).toBe(1);
  });

  it('headers() expõe response headers (ex.: Link rel="next" para cursor pagination)', async () => {
    const resource = iniciar<readonly Edital[]>(() => '/api/selecao/editais');

    await responder('/api/selecao/editais', [{ id: 'edt-1', numero: 1 }], {
      ...RESPOSTA_OK,
      headers: { Link: LINK_PROXIMA_PAGINA },
    });

    expect(resource.headers()?.get('Link')).toBe(LINK_PROXIMA_PAGINA);
  });

  it('hasValue() reflete presença de envelope (loading=false e value definido)', async () => {
    const resource = iniciar<Edital>(() => URL_EDITAL);
    expect(resource.hasValue()).toBe(false);

    await responder(URL_EDITAL, { id: 'edt-1', numero: 5 });

    expect(resource.hasValue()).toBe(true);
  });

  it('422 com errors[] de validação preserva o array no problem()', async () => {
    const resource = iniciar<Edital>(() => '/api/selecao/editais');
    await responder('/api/selecao/editais', problemaDeValidacao, RESPOSTA_NAO_PROCESSAVEL);

    const problem = resource.problem();
    expect(problem?.code).toBe('uniplus.validacao');
    expect(problem?.errors).toHaveLength(1);
    expect(problem?.errors?.[0]).toEqual({
      field: 'titulo',
      code: 'Titulo.Vazio',
      message: 'Título obrigatório',
    });
  });
});

/**
 * Cenário isolado em describe próprio porque exige um interceptor adicional que
 * faz o `Resource.value()` nativo do Angular lançar `ResourceValueError`. O
 * wrapper deve isolar o caller — `data()`/`problem()`/`value()` retornam
 * ausência segura em estado `'error'`, em vez de propagar a exceção e crashar a
 * página durante change detection.
 */
describe('useApiResource — guarda contra Resource.value() throw em status error', () => {
  async function resourceComInterceptorQueLanca(): Promise<UseApiResourceRef<Edital>> {
    TestBed.configureTestingModule({
      providers: provedoresDeHttpComEnvelope(interceptorQueLancaErroNaoHttp),
    });
    const appRef = TestBed.inject(ApplicationRef);
    const injector = TestBed.inject(Injector);
    const resource = TestBed.runInInjectionContext(() =>
      useApiResource<Edital>(() => URL_EDITAL, { injector }),
    );
    appRef.tick();
    await appRef.whenStable();
    return resource;
  }

  it('data()/problem()/value() retornam ausência sem lançar quando status=error', async () => {
    const resource = await resourceComInterceptorQueLanca();

    expect(resource.status()).toBe('error');
    expect(resource.error()).toBeInstanceOf(Error);
    expect(() => resource.data()).not.toThrow();
    expect(() => resource.problem()).not.toThrow();
    expect(() => resource.value()).not.toThrow();
    expect(resource.data()).toBeNull();
    expect(resource.problem()).toBeNull();
    expect(resource.value()).toBeUndefined();
  });
});
