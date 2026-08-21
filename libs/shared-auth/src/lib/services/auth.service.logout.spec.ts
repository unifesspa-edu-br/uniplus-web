import { TestBed } from '@angular/core/testing';
import type Keycloak from 'keycloak-js';
import { AuthService } from './auth.service';
import { AuthConfig } from '../models/auth-config.model';

const config: AuthConfig = {
  issuerUrl: 'http://localhost:8080/realms/unifesspa',
  clientId: 'selecao-web',
  allowedUrls: ['http://localhost:5000/api/v1', 'http://localhost:8080/realms/unifesspa'],
};

function stubKeycloak(partial: Partial<Keycloak>): Keycloak {
  return {
    init: async () => true,
    token: undefined,
    authenticated: true,
    realmAccess: undefined,
    subject: undefined,
    isTokenExpired: () => false,
    updateToken: async () => false,
    login: async () => undefined,
    logout: async () => undefined,
    loadUserProfile: async () => ({}),
    tokenParsed: {},
    ...partial,
  } as unknown as Keycloak;
}

describe('AuthService.logout — redireciona ao mount point (Story #447)', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  it('redireciona pra document.baseURI (raiz) em standalone-compact/lab', async () => {
    const logoutSpy = vi.fn(async () => undefined);
    vi.spyOn(service as unknown as { createKeycloak: () => Keycloak }, 'createKeycloak')
      .mockReturnValue(stubKeycloak({ logout: logoutSpy }));

    await service.init(config);
    await service.logout();

    expect(logoutSpy).toHaveBeenCalledWith(
      expect.objectContaining({ redirectUri: document.baseURI }),
    );
  });

  it('redireciona pro subpath (/portal/) quando servido sob mount point, não pra raiz do host', async () => {
    const base = document.createElement('base');
    base.href = 'http://localhost:3000/portal/';
    document.head.appendChild(base);
    try {
      const logoutSpy = vi.fn(async () => undefined);
      vi.spyOn(service as unknown as { createKeycloak: () => Keycloak }, 'createKeycloak')
        .mockReturnValue(stubKeycloak({ logout: logoutSpy }));

      await service.init(config);
      await service.logout();

      expect(logoutSpy).toHaveBeenCalledWith(
        expect.objectContaining({ redirectUri: 'http://localhost:3000/portal/' }),
      );
      // Regressão explícita: window.location.origin não tem rota própria
      // sob PathPrefix (nginx.conf parametrizado pela Story #448) —
      // cairia no 404 do Traefik.
      expect(logoutSpy.mock.calls[0][0]).not.toEqual(
        expect.objectContaining({ redirectUri: window.location.origin }),
      );
    } finally {
      base.remove();
    }
  });
});
