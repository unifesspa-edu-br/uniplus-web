import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

interface KeycloakLike {
  updateToken: (minValidity: number) => Promise<boolean>;
  logout: () => Promise<void>;
  token?: string;
}

/**
 * Injeta um duplo de Keycloak no AuthService sem passar por `init()`
 * (que depende do DOM e de rede). Usa a propriedade privada `keycloak`
 * através de um cast controlado.
 */
function attachFakeKeycloak(service: AuthService, fake: KeycloakLike): void {
  (service as unknown as { keycloak: KeycloakLike }).keycloak = fake;
}

describe('AuthService — serialização de refreshToken', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  it('compartilha uma única chamada de updateToken quando refreshToken é disparado em paralelo', async () => {
    const updateToken = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          setTimeout(() => resolve(true), 10);
        }),
    );
    attachFakeKeycloak(service, {
      updateToken,
      logout: async () => undefined,
    });

    const [a, b, c] = await Promise.all([
      service.refreshToken(30),
      service.refreshToken(30),
      service.refreshToken(30),
    ]);

    expect(updateToken).toHaveBeenCalledTimes(1);
    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(c).toBe(true);
  });

  it('permite novo refresh após a promise em voo resolver', async () => {
    const updateToken = vi.fn(async () => true);
    attachFakeKeycloak(service, {
      updateToken,
      logout: async () => undefined,
    });

    await service.refreshToken(30);
    await service.refreshToken(30);

    expect(updateToken).toHaveBeenCalledTimes(2);
  });

  it('dispara logout() quando Keycloak retorna "reuse exceeded"', async () => {
    const logout = vi.fn(async () => undefined);
    attachFakeKeycloak(service, {
      updateToken: async () => {
        throw {
          error: 'invalid_grant',
          error_description: 'Maximum allowed refresh token reuse exceeded',
        };
      },
      logout,
    });

    const result = await service.refreshToken(30);

    expect(result).toBe(false);
    expect(service.authenticated()).toBe(false);
    // logout é disparado via `void this.logout()` — esperar microtask
    await Promise.resolve();
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('dispara logout() quando Keycloak retorna "session not active"', async () => {
    const logout = vi.fn(async () => undefined);
    attachFakeKeycloak(service, {
      updateToken: async () => {
        throw { error: 'invalid_grant', error_description: 'Session not active' };
      },
      logout,
    });

    await service.refreshToken(30);
    await Promise.resolve();

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('NÃO dispara logout() para erros de rede genéricos', async () => {
    const logout = vi.fn(async () => undefined);
    attachFakeKeycloak(service, {
      updateToken: async () => {
        throw new Error('Network request failed');
      },
      logout,
    });

    const result = await service.refreshToken(30);

    expect(result).toBe(false);
    expect(service.authenticated()).toBe(false);
    await Promise.resolve();
    expect(logout).not.toHaveBeenCalled();
  });

  it('libera a promise em voo mesmo quando o refresh lança', async () => {
    attachFakeKeycloak(service, {
      updateToken: async () => {
        throw new Error('Network fail');
      },
      logout: async () => undefined,
    });

    await service.refreshToken(30);
    expect(service._getRefreshInFlight()).toBeNull();
  });
});
