import { TestBed } from '@angular/core/testing';
import type Keycloak from 'keycloak-js';
import { AuthService } from './auth.service';
import { AuthConfig } from '../models/auth-config.model';

const config: AuthConfig = {
  keycloakUrl: 'http://localhost:8080',
  realm: 'unifesspa',
  clientId: 'selecao-web',
  allowedUrls: ['http://localhost:5000/api/v1', 'http://localhost:8080'],
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

describe('AuthService.init — resiliência a Keycloak indisponível', () => {
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

  it('captura erro do Keycloak.init() e NÃO propaga; expõe initError()', async () => {
    vi.spyOn(service as unknown as { createKeycloak: () => Keycloak }, 'createKeycloak')
      .mockReturnValue(stubKeycloak({
        init: () => Promise.reject(new Error('Keycloak offline')),
      }));

    const result = await service.init(config);

    expect(result).toBe(false);
    expect(service.initError()).toBe('Keycloak offline');
    expect(service.authenticated()).toBe(false);
  });

  it('propaga false (não autenticado) quando init() resolve com false, sem erro', async () => {
    vi.spyOn(service as unknown as { createKeycloak: () => Keycloak }, 'createKeycloak')
      .mockReturnValue(stubKeycloak({ init: async () => false }));

    const result = await service.init(config);

    expect(result).toBe(false);
    expect(service.initError()).toBeNull();
  });

  it('init bem-sucedido limpa initError anterior', async () => {
    const spy = vi.spyOn(
      service as unknown as { createKeycloak: () => Keycloak },
      'createKeycloak',
    );

    spy.mockReturnValueOnce(stubKeycloak({
      init: () => Promise.reject(new Error('down')),
    }));
    await service.init(config);
    expect(service.initError()).toBe('down');

    spy.mockReturnValueOnce(stubKeycloak({ init: async () => false }));
    const result = await service.init(config);

    expect(result).toBe(false);
    expect(service.initError()).toBeNull();
  });

  it('usa mensagem humanizada padrão quando o erro não tem descrição', async () => {
    vi.spyOn(service as unknown as { createKeycloak: () => Keycloak }, 'createKeycloak')
      .mockReturnValue(stubKeycloak({
        init: () => Promise.reject({}),
      }));

    await service.init(config);

    expect(service.initError()).toBe('Não foi possível contatar o provedor de autenticação.');
  });

  it('captura erro lançado pelo próprio construtor do Keycloak', async () => {
    vi.spyOn(service as unknown as { createKeycloak: () => Keycloak }, 'createKeycloak')
      .mockImplementation(() => {
        throw new Error('cannot reach');
      });

    const result = await service.init(config);

    expect(result).toBe(false);
    expect(service.initError()).toBe('cannot reach');
  });

  it('registra callback onTokenExpired que dispara refreshToken()', async () => {
    let capturedCallback: (() => void) | undefined;
    const kc = stubKeycloak({ init: async () => true });
    // Captura de onTokenExpired via setter-ish
    Object.defineProperty(kc, 'onTokenExpired', {
      configurable: true,
      get() {
        return capturedCallback;
      },
      set(fn: () => void) {
        capturedCallback = fn;
      },
    });

    vi.spyOn(service as unknown as { createKeycloak: () => Keycloak }, 'createKeycloak')
      .mockReturnValue(kc);
    // loadProfile depende de loadUserProfile — stub já retorna {}
    const refreshSpy = vi.spyOn(service, 'refreshToken').mockResolvedValue(true);

    await service.init(config);

    expect(capturedCallback).toBeInstanceOf(Function);
    capturedCallback?.();
    // `refreshToken` é chamado de forma fire-and-forget via `void`
    expect(refreshSpy).toHaveBeenCalledWith(30);
  });
});
