import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpHandlerFn, HttpRequest, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom, of } from 'rxjs';
import { tokenInterceptor } from './token.interceptor';
import { AuthService } from '../services/auth.service';
import { AUTH_ALLOWED_URLS } from '../tokens/auth.tokens';

// Utilitário: drena microtarefas para permitir que a cadeia
// defer → Promise → switchMap do interceptor chegue ao backend.
async function flushMicrotasks(times = 5): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

describe('tokenInterceptor — allowlist', () => {
  const apiUrl = 'http://localhost:5000/api/v1';
  const keycloakUrl = 'http://localhost:8080';
  const externalUrl = 'https://evil.example.com/leak';

  function setup(
    allowedUrls: readonly string[],
    tokenValue: { token: string | undefined } = { token: 'fake-token' },
    opts: { expired?: boolean; refresh?: () => Promise<boolean> } = {},
  ) {
    let token = tokenValue.token;
    const authService = {
      getToken: () => token,
      isTokenExpired: () => opts.expired ?? false,
      refreshToken: async (minValidity = 30) => {
        void minValidity;
        if (opts.refresh) return opts.refresh();
        token = 'refreshed-token';
        return true;
      },
    } as unknown as AuthService;

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([tokenInterceptor])),
        provideHttpClientTesting(),
        { provide: AUTH_ALLOWED_URLS, useValue: allowedUrls },
        { provide: AuthService, useValue: authService },
      ],
    });

    return {
      http: TestBed.inject(HttpClient),
      httpMock: TestBed.inject(HttpTestingController),
    };
  }

  it('anexa Bearer quando a URL está na allowlist (API)', async () => {
    const { http, httpMock } = setup([apiUrl, keycloakUrl]);

    const promise = firstValueFrom(http.get(`${apiUrl}/editais`));
    await flushMicrotasks();
    const req = httpMock.expectOne(`${apiUrl}/editais`);

    expect(req.request.headers.get('Authorization')).toBe('Bearer fake-token');
    req.flush({});
    await promise;
    httpMock.verify();
  });

  it('anexa Bearer quando a URL está na allowlist (Keycloak)', async () => {
    const { http, httpMock } = setup([apiUrl, keycloakUrl]);

    const url = `${keycloakUrl}/realms/unifesspa/protocol/openid-connect/userinfo`;
    const promise = firstValueFrom(http.get(url));
    await flushMicrotasks();
    const req = httpMock.expectOne(url);

    expect(req.request.headers.get('Authorization')).toBe('Bearer fake-token');
    req.flush({});
    await promise;
    httpMock.verify();
  });

  it('NÃO anexa Bearer para URL fora da allowlist (domínio externo)', async () => {
    const { http, httpMock } = setup([apiUrl, keycloakUrl]);

    const promise = firstValueFrom(http.get(externalUrl));
    const req = httpMock.expectOne(externalUrl);

    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
    await promise;
    httpMock.verify();
  });

  it('NÃO anexa Bearer quando allowlist está vazia (default conservador)', async () => {
    const { http, httpMock } = setup([]);

    const promise = firstValueFrom(http.get(`${apiUrl}/editais`));
    const req = httpMock.expectOne(`${apiUrl}/editais`);

    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
    await promise;
    httpMock.verify();
  });

  it('NÃO anexa Bearer para URL que apenas começa igual mas em outro host', async () => {
    const { http, httpMock } = setup(['http://localhost:5000']);

    const trap = 'http://localhost:50000/api/v1/hack';
    const promise = firstValueFrom(http.get(trap));
    const req = httpMock.expectOne(trap);

    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
    await promise;
    httpMock.verify();
  });

  it('dispara refreshToken() e anexa o Bearer quando o token está expirado', async () => {
    const refreshMock = vi.fn(async () => true);
    const { http, httpMock } = setup(
      [apiUrl],
      { token: 'stale-token' },
      { expired: true, refresh: refreshMock },
    );

    const promise = firstValueFrom(http.get(`${apiUrl}/refresh-before-attach`));
    await flushMicrotasks();
    const req = httpMock.expectOne(`${apiUrl}/refresh-before-attach`);

    expect(refreshMock).toHaveBeenCalledTimes(1);
    // getToken() é relido após o refresh; como o mock refresh não rotaciona
    // o valor local (função custom), o header carrega o token original —
    // o essencial é validar que refresh foi disparado antes do envio.
    expect(req.request.headers.get('Authorization')).toBe('Bearer stale-token');
    req.flush({});
    await promise;
    httpMock.verify();
  });

  it('NÃO chama refreshToken() quando o token ainda é válido', async () => {
    const refreshMock = vi.fn(async () => true);
    const { http, httpMock } = setup(
      [apiUrl],
      { token: 'fresh-token' },
      { expired: false, refresh: refreshMock },
    );

    const promise = firstValueFrom(http.get(`${apiUrl}/no-refresh`));
    await flushMicrotasks();
    const req = httpMock.expectOne(`${apiUrl}/no-refresh`);

    expect(refreshMock).not.toHaveBeenCalled();
    expect(req.request.headers.get('Authorization')).toBe('Bearer fresh-token');
    req.flush({});
    await promise;
    httpMock.verify();
  });

  it('NÃO anexa Bearer quando não há token disponível, mesmo em URL permitida', async () => {
    const { http, httpMock } = setup([apiUrl], { token: undefined });

    const promise = firstValueFrom(http.get(`${apiUrl}/ping`));
    await flushMicrotasks();
    const req = httpMock.expectOne(`${apiUrl}/ping`);

    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
    await promise;
    httpMock.verify();
  });
});

// Sanity check: chamada direta à função do interceptor sem HttpClient.
describe('tokenInterceptor — chamada direta', () => {
  it('encaminha a requisição inalterada se a URL não está na allowlist', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: AUTH_ALLOWED_URLS, useValue: ['http://allowed.example.com'] },
        {
          provide: AuthService,
          useValue: {
            getToken: () => 'tok',
            isTokenExpired: () => false,
            refreshToken: async () => true,
          } as unknown as AuthService,
        },
      ],
    });

    const req = new HttpRequest('GET', 'https://other.example.com/x');
    const next: HttpHandlerFn = (r) => {
      expect(r.headers.has('Authorization')).toBe(false);
      return of({} as never);
    };

    TestBed.runInInjectionContext(() => tokenInterceptor(req, next));
  });
});
