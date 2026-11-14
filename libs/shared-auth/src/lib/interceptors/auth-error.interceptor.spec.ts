import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiResult, apiResultInterceptor, ProblemDetails } from '@uniplus/shared-core/http';
import { authErrorInterceptor } from './auth-error.interceptor';
import { AuthService } from '../services/auth.service';

const PROBLEM_HEADERS = { 'Content-Type': 'application/problem+json' };

const baseProblem: ProblemDetails = {
  type: 'https://unifesspa-edu-br.github.io/uniplus-developers/erros/uniplus.auth.unauthorized',
  title: 'Não autenticado',
  status: 401,
  code: 'uniplus.auth.unauthorized',
  traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
};

const problemaProibido: ProblemDetails = {
  ...baseProblem,
  code: 'uniplus.auth.forbidden',
  status: 403,
  title: 'Acesso negado',
};

describe('authErrorInterceptor (consumindo ApiResult)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function setup() {
    const login = vi.fn();
    const navigate = vi.fn();
    const authServiceMock = { login } as unknown as AuthService;
    const routerMock = { navigate } as unknown as Router;

    TestBed.configureTestingModule({
      providers: [
        // A ordem aqui replica a registrada nos apps:
        // authErrorInterceptor é mais externo que apiResultInterceptor,
        // portanto recebe o HttpResponse já envelopado pelo apiResult.
        provideHttpClient(withInterceptors([authErrorInterceptor, apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceMock },
        { provide: Router, useValue: routerMock },
      ],
    });

    return {
      http: TestBed.inject(HttpClient),
      httpMock: TestBed.inject(HttpTestingController),
      login,
      navigate,
    };
  }

  type Contexto = ReturnType<typeof setup>;

  async function receberProblema(
    { http, httpMock }: Contexto,
    url: string,
    problema: ProblemDetails,
  ): Promise<ApiResult<unknown>> {
    const promise = firstValueFrom(http.get<ApiResult<unknown>>(url));
    const resposta = { status: problema.status, statusText: 'error', headers: PROBLEM_HEADERS };
    httpMock.expectOne(url).flush(problema, resposta);
    return promise;
  }

  async function receberFalhaDeRede({ http, httpMock }: Contexto, url: string) {
    const promise = firstValueFrom(http.get<ApiResult<unknown>>(url));
    httpMock.expectOne(url).error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown' });
    return promise;
  }

  function esperarSemRedirecionamento({ login, navigate }: Contexto): void {
    expect(login).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  }

  it('401 (envelopado em ApiFailure) chama authService.login() e devolve ApiFailure ao consumer', async () => {
    const ctx = setup();

    const result = await receberProblema(ctx, '/api/protegido', baseProblem);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(ctx.login).toHaveBeenCalledTimes(1);
    expect(ctx.navigate).not.toHaveBeenCalled();
  });

  it('403 (envelopado em ApiFailure) redireciona para /acesso-negado', async () => {
    const ctx = setup();

    const result = await receberProblema(ctx, '/api/admin', problemaProibido);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(ctx.navigate).toHaveBeenCalledWith(['/acesso-negado']);
    expect(ctx.login).not.toHaveBeenCalled();
  });

  it.each([500, 404])(
    'status %i entrega ApiFailure ao consumer sem login nem navigate',
    async (status) => {
      const ctx = setup();
      const problema = { ...baseProblem, status, code: `uniplus.test.${status}` };

      const result = await receberProblema(ctx, `/api/x${status}`, problema);

      expect(result.ok).toBe(false);
      expect(result.status).toBe(status);
      esperarSemRedirecionamento(ctx);
    },
  );

  it('status 0 (falha de rede) entrega ApiFailure ao consumer sem login nem navigate', async () => {
    const ctx = setup();

    const result = await receberFalhaDeRede(ctx, '/api/x0');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    esperarSemRedirecionamento(ctx);
  });

  it('resposta 2xx envelopa em ApiOk sem disparar redirect', async () => {
    const ctx = setup();

    const promise = firstValueFrom(ctx.http.get<ApiResult<{ ok: boolean }>>('/api/ok'));
    ctx.httpMock.expectOne('/api/ok').flush({ ok: true });

    const result = await promise;
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ ok: true });
    }
    esperarSemRedirecionamento(ctx);
  });
});
