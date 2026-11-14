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

function novoServico(): AuthService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({});
  return TestBed.inject(AuthService);
}

async function iniciarComKeycloak(service: AuthService, partial: Partial<Keycloak>): Promise<void> {
  espiarCriacaoDoKeycloak(service).mockReturnValue(stubKeycloak(partial));
  await service.init(config);
}

describe('AuthService.login — volta à rota pedida, sob o mount point', () => {
  beforeEach(() => instalarBase('http://localhost:3000/portal/'));

  it('resolve a rota de volta contra document.baseURI', async () => {
    const service = novoServico();
    const loginSpy = vi.fn(async () => undefined);
    await iniciarComKeycloak(service, { login: loginSpy });

    await service.login('/inscricao/processo-1');

    expect(loginSpy).toHaveBeenCalledWith({
      redirectUri: 'http://localhost:3000/portal/inscricao/processo-1',
    });
  });
});

describe('AuthService.atualizarPerfil — abre a atualização de perfil do provedor', () => {
  it('pede a ação UPDATE_PROFILE e deixa o provedor voltar à página atual', async () => {
    const service = novoServico();
    const loginSpy = vi.fn(async () => undefined);
    await iniciarComKeycloak(service, { login: loginSpy });

    await service.atualizarPerfil();

    expect(loginSpy).toHaveBeenCalledWith({ action: 'UPDATE_PROFILE' });
  });
});

describe('AuthService.logout — redireciona ao mount point (Story #447)', () => {
  let service: AuthService;

  beforeEach(() => {
    service = novoServico();
  });

  async function encerrarSessao() {
    const logoutSpy = vi.fn<Keycloak['logout']>(async () => undefined);
    await iniciarComKeycloak(service, { logout: logoutSpy });
    await service.logout();
    return logoutSpy;
  }

  it('redireciona pra document.baseURI (raiz) em standalone-compact/lab', async () => {
    const logoutSpy = await encerrarSessao();

    expect(logoutSpy).toHaveBeenCalledWith(
      expect.objectContaining({ redirectUri: document.baseURI }),
    );
  });

  describe('servido sob subpath', () => {
    beforeEach(() => instalarBase('http://localhost:3000/portal/'));

    it('redireciona pro subpath (/portal/) quando servido sob mount point, não pra raiz do host', async () => {
      const logoutSpy = await encerrarSessao();

      expect(logoutSpy).toHaveBeenCalledWith(
        expect.objectContaining({ redirectUri: 'http://localhost:3000/portal/' }),
      );
      // Regressão explícita: window.location.origin não tem rota própria
      // sob PathPrefix (nginx.conf parametrizado) —
      // cairia no 404 do Traefik.
      expect(logoutSpy.mock.calls[0][0]).not.toEqual(
        expect.objectContaining({ redirectUri: window.location.origin }),
      );
    });
  });
});
