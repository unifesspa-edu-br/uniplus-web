import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

interface KeycloakDeTeste {
  updateToken: () => Promise<boolean>;
  refreshTokenParsed?: { iat: number; exp: number };
  tokenParsed?: { iat: number; exp: number };
  timeSkew?: number;
}

function renovarCom(service: AuthService, keycloak: KeycloakDeTeste): Promise<boolean> {
  (service as unknown as { keycloak: KeycloakDeTeste }).keycloak = keycloak;
  return service.refreshToken(30);
}

describe('AuthService — prazo da credencial de renovação', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  it('começa sem prazo', () => {
    expect(service.prazoDaCredencial()).toBeNull();
  });

  it('lê o prazo da credencial depois de renovar', async () => {
    await renovarCom(service, {
      updateToken: async () => true,
      refreshTokenParsed: { iat: 1000, exp: 1600 },
      timeSkew: 2,
    });

    expect(service.prazoDaCredencial()?.venceEm).toBe(1602 * 1000);
    expect(service.prazoDaCredencial()?.limite).toBe('inatividade');
  });

  it('lê quando o acesso foi emitido e quando vence, corrigindo a diferença de relógio', async () => {
    await renovarCom(service, {
      updateToken: async () => true,
      tokenParsed: { iat: 1000, exp: 1300 },
      timeSkew: 2,
    });

    expect(service.prazoDoAcesso()).toEqual({ emitidoEm: 1002 * 1000, venceEm: 1302 * 1000 });
  });

  it('não muda o prazo quando a renovação não troca a credencial', async () => {
    await renovarCom(service, { updateToken: async () => false });

    expect(service.prazoDaCredencial()).toBeNull();
  });

  it('descarta o prazo ao encerrar a sessão', async () => {
    await renovarCom(service, {
      updateToken: async () => true,
      refreshTokenParsed: { iat: 1000, exp: 1600 },
    });

    service.encerrarSessao();

    expect(service.prazoDaCredencial()).toBeNull();
    expect(service.prazoDoAcesso()).toBeNull();
  });

  it('não volta a publicar prazos quando uma renovação em andamento termina depois de a sessão encerrar', async () => {
    service.encerrarSessao();

    await renovarCom(service, {
      updateToken: async () => true,
      tokenParsed: { iat: 1000, exp: 1300 },
      refreshTokenParsed: { iat: 1000, exp: 1600 },
    });

    expect(service.prazoDoAcesso()).toBeNull();
    expect(service.prazoDaCredencial()).toBeNull();
  });
});
