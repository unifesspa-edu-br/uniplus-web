import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  ApiResult,
  apiResultInterceptor,
  ProblemDetails,
} from '@uniplus/shared-core';
import { authErrorInterceptor } from './auth-error.interceptor';
import { AuthService } from '../services/auth.service';

const PROBLEM_HEADERS = { 'Content-Type': 'application/problem+json' };

const baseProblem: ProblemDetails = {
  type: 'https://uniplus.unifesspa.edu.br/errors/uniplus.auth.unauthorized',
  title: 'Não autenticado',
  status: 401,
  code: 'uniplus.auth.unauthorized',
  traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
};

describe('authErrorInterceptor (consumindo ApiResult)', () => {
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
        provideHttpClient(
          withInterceptors([authErrorInterceptor, apiResultInterceptor]),
        ),
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

  it('401 (envelopado em ApiFailure) chama authService.login() e devolve ApiFailure ao consumer', async () => {
    const { http, httpMock, login, navigate } = setup();

    const promise = firstValueFrom(http.get<ApiResult<unknown>>('/api/protegido'));
    httpMock
      .expectOne('/api/protegido')
      .flush(baseProblem, { status: 401, statusText: 'Unauthorized', headers: PROBLEM_HEADERS });

    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(login).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    httpMock.verify();
  });

  it('403 (envelopado em ApiFailure) redireciona para /acesso-negado', async () => {
    const { http, httpMock, login, navigate } = setup();

    const promise = firstValueFrom(http.get<ApiResult<unknown>>('/api/admin'));
    httpMock.expectOne('/api/admin').flush(
      { ...baseProblem, code: 'uniplus.auth.forbidden', status: 403, title: 'Acesso negado' },
      { status: 403, statusText: 'Forbidden', headers: PROBLEM_HEADERS },
    );

    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(navigate).toHaveBeenCalledWith(['/acesso-negado']);
    expect(login).not.toHaveBeenCalled();
    httpMock.verify();
  });

  it('outros status (500, 404, 0) entregam ApiFailure ao consumer sem login nem navigate', async () => {
    const { http, httpMock, login, navigate } = setup();

    for (const status of [500, 404]) {
      const promise = firstValueFrom(http.get<ApiResult<unknown>>(`/api/x${status}`));
      httpMock
        .expectOne(`/api/x${status}`)
        .flush({ ...baseProblem, status, code: `uniplus.test.${status}` }, {
          status,
          statusText: 'error',
          headers: PROBLEM_HEADERS,
        });
      const result = await promise;
      expect(result.ok).toBe(false);
      expect(result.status).toBe(status);
    }

    const promise0 = firstValueFrom(http.get<ApiResult<unknown>>('/api/x0'));
    httpMock.expectOne('/api/x0').error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown' });
    const result0 = await promise0;
    expect(result0.ok).toBe(false);
    expect(result0.status).toBe(0);

    expect(login).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    httpMock.verify();
  });

  it('resposta 2xx envelopa em ApiOk sem disparar redirect', async () => {
    const { http, httpMock, login, navigate } = setup();

    const promise = firstValueFrom(http.get<ApiResult<{ ok: boolean }>>('/api/ok'));
    httpMock.expectOne('/api/ok').flush({ ok: true });

    const result = await promise;
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ ok: true });
    }
    expect(login).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    httpMock.verify();
  });
});
