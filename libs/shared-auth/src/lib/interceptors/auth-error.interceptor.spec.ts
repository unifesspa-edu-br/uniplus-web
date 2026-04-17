import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { authErrorInterceptor } from './auth-error.interceptor';
import { AuthService } from '../services/auth.service';

describe('authErrorInterceptor', () => {
  function setup() {
    const login = vi.fn();
    const navigate = vi.fn();
    const authServiceMock = { login } as unknown as AuthService;
    const routerMock = { navigate } as unknown as Router;

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authErrorInterceptor])),
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

  it('401 → chama authService.login() e propaga o erro', async () => {
    const { http, httpMock, login, navigate } = setup();

    const promise = firstValueFrom(http.get('/api/protegido')).catch((e) => e);
    const req = httpMock.expectOne('/api/protegido');
    req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    const err = await promise;
    expect(err.status).toBe(401);
    expect(login).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    httpMock.verify();
  });

  it('403 → redireciona para /acesso-negado e propaga o erro', async () => {
    const { http, httpMock, login, navigate } = setup();

    const promise = firstValueFrom(http.get('/api/admin')).catch((e) => e);
    const req = httpMock.expectOne('/api/admin');
    req.flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

    const err = await promise;
    expect(err.status).toBe(403);
    expect(navigate).toHaveBeenCalledWith(['/acesso-negado']);
    expect(login).not.toHaveBeenCalled();
    httpMock.verify();
  });

  it('outros status (500, 404, 0) não disparam login nem navigate', async () => {
    const { http, httpMock, login, navigate } = setup();

    for (const status of [500, 404, 0]) {
      const promise = firstValueFrom(http.get(`/api/x${status}`)).catch((e) => e);
      const req = httpMock.expectOne(`/api/x${status}`);
      req.flush({}, { status, statusText: 'error' });
      await promise;
    }

    expect(login).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    httpMock.verify();
  });

  it('resposta 2xx passa inalterada', async () => {
    const { http, httpMock, login, navigate } = setup();

    const promise = firstValueFrom(http.get<{ ok: boolean }>('/api/ok'));
    const req = httpMock.expectOne('/api/ok');
    req.flush({ ok: true });

    const body = await promise;
    expect(body.ok).toBe(true);
    expect(login).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    httpMock.verify();
  });
});
