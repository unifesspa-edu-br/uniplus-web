import { TestBed } from '@angular/core/testing';
import type Keycloak from 'keycloak-js';
import { AuthService } from './auth.service';
import { AuthConfig } from '../models/auth-config.model';
import { espiarCriacaoDoKeycloak, instalarBase } from './auth.service.testing';

const config: AuthConfig = {
  issuerUrl: 'http://localhost:8080/realms/unifesspa',
  clientId: 'selecao-web',
  allowedUrls: ['http://localhost:5000/api/v1', 'http://localhost:8080/realms/unifesspa'],
};

function stubKeycloak(partial: Partial<Keycloak>): Keycloak {
  return {
    init: async () => false,
    token: undefined,
    authenticated: false,
    realmAccess: undefined,
    subject: undefined,
    isTokenExpired: () => true,
    updateToken: async () => false,
    login: async () => undefined,
    logout: async () => undefined,
    loadUserProfile: async () => ({}),
    ...partial,
  } as unknown as Keycloak;
}

describe('AuthService.init — resiliência a provedor OIDC indisponível', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  it('initError() começa null', () => {
    expect(service.initError()).toBeNull();
    expect(service.authenticated()).toBe(false);
  });

  async function iniciarComKeycloak(partial: Partial<Keycloak>): Promise<boolean> {
    espiarCriacaoDoKeycloak(service).mockReturnValue(stubKeycloak(partial));
    return service.init(config);
  }

  function stubQueGuardaOnTokenExpired() {
    let callback: (() => void) | undefined;
    const kc = stubKeycloak({ init: async () => true });
    Object.defineProperty(kc, 'onTokenExpired', {
      configurable: true,
      get: () => callback,
      set: (fn: () => void) => {
        callback = fn;
      },
    });
    return { kc, callbackCapturado: () => callback };
  }

  it('captura erro do adapter OIDC e NÃO propaga; expõe initError()', async () => {
    const result = await iniciarComKeycloak({
      init: () => Promise.reject(new Error('OIDC offline')),
    });

    expect(result).toBe(false);
    expect(service.initError()).toBe('OIDC offline');
    expect(service.authenticated()).toBe(false);
  });

  it('propaga false (não autenticado) quando init() resolve com false, sem erro', async () => {
    const result = await iniciarComKeycloak({ init: async () => false });

    expect(result).toBe(false);
    expect(service.initError()).toBeNull();
  });

  it('init bem-sucedido limpa initError anterior', async () => {
    const spy = espiarCriacaoDoKeycloak(service);

    spy.mockReturnValueOnce(stubKeycloak({ init: () => Promise.reject(new Error('down')) }));
    await service.init(config);
    expect(service.initError()).toBe('down');

    spy.mockReturnValueOnce(stubKeycloak({ init: async () => false }));
    const result = await service.init(config);

    expect(result).toBe(false);
    expect(service.initError()).toBeNull();
  });

  it('usa mensagem humanizada padrão quando o erro não tem descrição', async () => {
    await iniciarComKeycloak({ init: () => Promise.reject({}) });

    expect(service.initError()).toBe('Não foi possível contatar o provedor de autenticação.');
  });

  it('captura erro lançado pelo próprio construtor do Keycloak', async () => {
    espiarCriacaoDoKeycloak(service).mockImplementation(() => {
      throw new Error('cannot reach');
    });

    const result = await service.init(config);

    expect(result).toBe(false);
    expect(service.initError()).toBe('cannot reach');
  });

  it('resolve silentCheckSsoRedirectUri relativo a document.baseURI (Story #446/#453)', async () => {
    const initSpy = vi.fn(async () => false);
    await iniciarComKeycloak({ init: initSpy });

    expect(initSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        silentCheckSsoRedirectUri: new URL(
          'assets/silent-check-sso.html',
          document.baseURI,
        ).toString(),
      }),
    );
  });

  describe('servido sob subpath', () => {
    beforeEach(() => instalarBase('http://localhost:3000/portal/'));

    it('resolve silentCheckSsoRedirectUri sob o mount point quando servido sob subpath', async () => {
      const initSpy = vi.fn(async () => false);
      await iniciarComKeycloak({ init: initSpy });

      expect(initSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          silentCheckSsoRedirectUri: 'http://localhost:3000/portal/assets/silent-check-sso.html',
        }),
      );
    });
  });

  it('registra callback onTokenExpired que dispara refreshToken()', async () => {
    const { kc, callbackCapturado } = stubQueGuardaOnTokenExpired();
    espiarCriacaoDoKeycloak(service).mockReturnValue(kc);
    const refreshSpy = vi.spyOn(service, 'refreshToken').mockResolvedValue(true);

    await service.init(config);

    expect(callbackCapturado()).toBeInstanceOf(Function);
    callbackCapturado()?.();
    // `refreshToken` é chamado de forma fire-and-forget via `void`
    expect(refreshSpy).toHaveBeenCalledWith(30);
  });
});
