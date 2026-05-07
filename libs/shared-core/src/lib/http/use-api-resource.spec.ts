import {
  HttpContext,
  HttpContextToken,
  HttpInterceptorFn,
  HttpResourceRequest,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef, Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor } from './api-result.interceptor';
import { ProblemDetails } from './problem-details';
import { useApiResource, UseApiResourceRef } from './use-api-resource';
import { withVendorMime } from './vendor-mime';

interface Edital {
  readonly id: string;
  readonly numero: number;
}

const PROBLEM_HEADERS = { 'Content-Type': 'application/problem+json' };
const baseProblem: ProblemDetails = {
  type: 'https://uniplus.unifesspa.edu.br/errors/uniplus.selecao.edital.nao_encontrado',
  title: 'Edital não encontrado',
  status: 404,
  code: 'uniplus.selecao.edital.nao_encontrado',
  traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
};

/**
 * Pattern de teste oficial do Angular team para `httpResource`
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
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
    ],
  });
  const appRef = TestBed.inject(ApplicationRef);
  const injector = TestBed.inject(Injector);
  return {
    controller: TestBed.inject(HttpTestingController),
    create: <T>(
      requestFn: () => string | HttpResourceRequest | undefined,
    ): UseApiResourceRef<T> =>
      TestBed.runInInjectionContext(() => useApiResource<T>(requestFn, { injector })),
    tickEffects: () => TestBed.tick(),
    stable: () => appRef.whenStable(),
  };
}

describe('useApiResource', () => {
  let env: ReturnType<typeof setup>;

  beforeEach(() => {
    env = setup();
  });

  afterEach(() => env.controller.verify());

  it('carga inicial com URL string dispara GET e popula data() em 200', async () => {
    const resource = env.create<Edital>(() => '/api/editais/edt-1');
    env.tickEffects();

    expect(resource.isLoading()).toBe(true);
    expect(resource.data()).toBeNull();

    const seed: Edital = { id: 'edt-1', numero: 42 };
    env.controller
      .expectOne('/api/editais/edt-1')
      .flush(seed, { status: 200, statusText: 'OK' });
    await env.stable();

    expect(resource.data()).toEqual(seed);
    expect(resource.problem()).toBeNull();
    expect(resource.isLoading()).toBe(false);
    expect(resource.status()).toBe('resolved');
    expect(resource.statusCode()).toBe(200);
    expect(resource.value()?.ok).toBe(true);
  });

  it('mudança reativa do URL cancela request anterior e dispara nova (race-cancellation nativa)', async () => {
    const id = signal('edt-1');
    const resource = env.create<Edital>(() => `/api/editais/${id()}`);
    env.tickEffects();

    const reqAntiga = env.controller.expectOne('/api/editais/edt-1');
    expect(reqAntiga.cancelled).toBe(false);

    id.set('edt-2');
    env.tickEffects();

    // httpResource cancela a request anterior automaticamente quando dependências
    // reativas mudam — substitui o race guard manual ("if (this.id() !== id) return").
    expect(reqAntiga.cancelled).toBe(true);

    const reqNova = env.controller.expectOne('/api/editais/edt-2');
    reqNova.flush({ id: 'edt-2', numero: 99 }, { status: 200, statusText: 'OK' });
    await env.stable();

    expect(resource.data()).toEqual({ id: 'edt-2', numero: 99 });
  });

  it('404 problem+json popula problem() e mantém data()=null', async () => {
    const resource = env.create<Edital>(() => '/api/editais/missing');
    env.tickEffects();

    env.controller
      .expectOne('/api/editais/missing')
      .flush(baseProblem, { status: 404, statusText: 'Not Found', headers: PROBLEM_HEADERS });
    await env.stable();

    expect(resource.data()).toBeNull();
    expect(resource.problem()).toMatchObject({
      code: 'uniplus.selecao.edital.nao_encontrado',
      status: 404,
    });
    expect(resource.value()?.ok).toBe(false);
    // status do Resource é resolved porque o interceptor envelopa o erro em
    // ApiResult.fail e re-emite via next — error() do Resource fica undefined.
    expect(resource.status()).toBe('resolved');
    expect(resource.error()).toBeUndefined();
  });

  it('network error (status 0) é envelopado como ApiFailure com code uniplus.client.network_error', async () => {
    const resource = env.create<Edital>(() => '/api/editais/edt-1');
    env.tickEffects();

    env.controller
      .expectOne('/api/editais/edt-1')
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await env.stable();

    expect(resource.data()).toBeNull();
    expect(resource.problem()?.code).toBe('uniplus.client.network_error');
    expect(resource.problem()?.status).toBe(0);
  });

  it('reload() refaz a request preservando dependências reativas atuais', async () => {
    const resource = env.create<Edital>(() => '/api/editais/edt-1');
    env.tickEffects();

    env.controller
      .expectOne('/api/editais/edt-1')
      .flush({ id: 'edt-1', numero: 1 }, { status: 200, statusText: 'OK' });
    await env.stable();

    expect(resource.data()).toEqual({ id: 'edt-1', numero: 1 });

    resource.reload();
    env.tickEffects();

    env.controller
      .expectOne('/api/editais/edt-1')
      .flush({ id: 'edt-1', numero: 2 }, { status: 200, statusText: 'OK' });
    await env.stable();

    expect(resource.data()).toEqual({ id: 'edt-1', numero: 2 });
  });

  it('request() retorna undefined => nenhum GET disparado, status=idle', async () => {
    const ativo = signal(false);
    const resource = env.create<Edital>(() =>
      ativo() ? '/api/editais/edt-1' : undefined,
    );
    env.tickEffects();

    expect(resource.status()).toBe('idle');
    expect(resource.data()).toBeNull();
    expect(resource.value()).toBeUndefined();
    // controller.verify() no afterEach garante que nenhuma request foi disparada.

    ativo.set(true);
    env.tickEffects();

    env.controller
      .expectOne('/api/editais/edt-1')
      .flush({ id: 'edt-1', numero: 7 }, { status: 200, statusText: 'OK' });
    await env.stable();

    expect(resource.data()).toEqual({ id: 'edt-1', numero: 7 });
  });

  it('aceita HttpResourceRequest com context (compõe withVendorMime no Accept)', async () => {
    const resource = env.create<Edital>(() => ({
      url: '/api/editais/edt-1',
      context: withVendorMime('edital', 1),
    }));
    env.tickEffects();

    const req = env.controller.expectOne('/api/editais/edt-1');
    expect(req.request.headers.get('Accept')).toBe('application/vnd.uniplus.edital.v1+json');

    req.flush({ id: 'edt-1', numero: 42 }, { status: 200, statusText: 'OK' });
    await env.stable();

    expect(resource.data()?.id).toBe('edt-1');
  });

  it('aceita HttpResourceRequest com context arbitrário (não amarrado a vendorMime)', async () => {
    // Token de exemplo para garantir que helper não acopla a um token específico —
    // qualquer HttpContext do caller é propagado intacto pelo httpResource.
    const FLAG_TOKEN = new HttpContextToken<boolean>(() => false);
    const resource = env.create<Edital>(() => ({
      url: '/api/editais/edt-1',
      context: new HttpContext().set(FLAG_TOKEN, true),
    }));
    env.tickEffects();

    const req = env.controller.expectOne('/api/editais/edt-1');
    expect(req.request.context.get(FLAG_TOKEN)).toBe(true);
    req.flush({ id: 'edt-1', numero: 1 }, { status: 200, statusText: 'OK' });
    await env.stable();

    expect(resource.data()?.numero).toBe(1);
  });

  it('headers() expõe response headers (ex.: Link rel="next" para cursor pagination)', async () => {
    const resource = env.create<readonly Edital[]>(() => '/api/editais');
    env.tickEffects();

    env.controller.expectOne('/api/editais').flush(
      [{ id: 'edt-1', numero: 1 }],
      {
        status: 200,
        statusText: 'OK',
        headers: { Link: '</api/editais?cursor=ABC>; rel="next"' },
      },
    );
    await env.stable();

    expect(resource.headers()?.get('Link')).toBe('</api/editais?cursor=ABC>; rel="next"');
  });

  it('hasValue() reflete presença de envelope (loading=false e value definido)', async () => {
    const resource = env.create<Edital>(() => '/api/editais/edt-1');
    env.tickEffects();

    expect(resource.hasValue()).toBe(false);

    env.controller
      .expectOne('/api/editais/edt-1')
      .flush({ id: 'edt-1', numero: 5 }, { status: 200, statusText: 'OK' });
    await env.stable();

    expect(resource.hasValue()).toBe(true);
  });

  it('422 com errors[] de validação preserva o array no problem()', async () => {
    const resource = env.create<Edital>(() => '/api/editais');
    env.tickEffects();

    env.controller.expectOne('/api/editais').flush(
      {
        ...baseProblem,
        type: 'https://uniplus.unifesspa.edu.br/errors/uniplus.validacao',
        title: 'Erro de validação',
        status: 422,
        code: 'uniplus.validacao',
        errors: [
          { field: 'titulo', code: 'Titulo.Vazio', message: 'Título obrigatório' },
        ],
      },
      { status: 422, statusText: 'Unprocessable Entity', headers: PROBLEM_HEADERS },
    );
    await env.stable();

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
 * Cenário isolado em describe próprio porque exige um interceptor adicional
 * (`throwingInterceptor`) que faz o `Resource.value()` nativo do Angular
 * lançar `ResourceValueError`. O wrapper deve isolar o caller — `data()`/
 * `problem()`/`value()` retornam ausência segura em estado `'error'`, em vez
 * de propagar a exceção e crashar a página durante change detection.
 */
describe('useApiResource — guarda contra Resource.value() throw em status error', () => {
  it('data()/problem()/value() retornam ausência sem lançar quando status=error', async () => {
    // Interceptor sintético que lança Error não-HttpErrorResponse ANTES do
    // request sair (caso real: interceptor de auth/logging/telemetria com bug
    // síncrono). O throw escapa do `envelopeFailure` do apiResultInterceptor
    // (que só captura HttpErrorResponse — linha 89: `if (!(error instanceof
    // HttpErrorResponse)) throw error;`) e chega ao httpResource em status
    // 'error', causando `Resource.value()` a lançar `ResourceValueError` se
    // chamado sem guard.
    const throwingInterceptor: HttpInterceptorFn = () => {
      throw new Error('synthetic non-HTTP failure (e.g. logging interceptor)');
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor, throwingInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    const appRef = TestBed.inject(ApplicationRef);
    const injector = TestBed.inject(Injector);
    const resource = TestBed.runInInjectionContext(() =>
      useApiResource<Edital>(() => '/api/editais/edt-1', { injector }),
    );
    appRef.tick();
    await appRef.whenStable();

    // Status do Resource é 'error' (interceptor throwing escapou da chain),
    // mas o helper isola: data()/problem()/value() retornam ausência segura.
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
