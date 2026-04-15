import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpHandlerFn, HttpRequest, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom, of } from 'rxjs';
import { tokenInterceptor } from './token.interceptor';
import { AuthService } from '../services/auth.service';
import { AUTH_ALLOWED_URLS } from '../tokens/auth.tokens';

describe('tokenInterceptor — allowlist', () => {
  const apiUrl = 'http://localhost:5000/api/v1';
  const keycloakUrl = 'http://localhost:8080';
  const externalUrl = 'https://evil.example.com/leak';

  function setup(allowedUrls: readonly string[], tokenValue: { token: string | undefined } = { token: 'fake-token' }) {
    const token = tokenValue.token;
    const authService = {
      getToken: () => token,
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
    // Ex.: allowed é http://localhost:5000 e a URL é http://localhost:50000 (prefix trap)
    const { http, httpMock } = setup(['http://localhost:5000']);

    const trap = 'http://localhost:50000/api/v1/hack';
    const promise = firstValueFrom(http.get(trap));
    const req = httpMock.expectOne(trap);

    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
    await promise;
    httpMock.verify();
  });

  it('NÃO anexa Bearer quando não há token disponível, mesmo em URL permitida', async () => {
    const { http, httpMock } = setup([apiUrl], { token: undefined });

    const promise = firstValueFrom(http.get(`${apiUrl}/ping`));
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
          useValue: { getToken: () => 'tok' } as unknown as AuthService,
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
