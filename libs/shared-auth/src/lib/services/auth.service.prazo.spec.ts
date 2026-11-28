import { TestBed } from '@angular/core/testing';
import type Keycloak from 'keycloak-js';
import { AuthService } from './auth.service';
import type { AuthConfig } from '../models/auth-config.model';
import { espiarCriacaoDoKeycloak } from './auth.service.testing';

const PERIODO_MAXIMO_EM_SEGUNDOS = 36000;
const AUTENTICADO_EM = 1000;

const configDeTeste: AuthConfig = {
  issuerUrl: 'http://localhost:8080/realms/unifesspa',
  clientId: 'selecao-web',
  antecedenciaDaRenovacaoEmSegundos: 60,
  periodoMaximoDaSessaoEmSegundos: PERIODO_MAXIMO_EM_SEGUNDOS,
  allowedUrls: [],
};

interface KeycloakDeTeste {
  updateToken: () => Promise<boolean>;
  refreshTokenParsed?: { iat: number; exp: number };
  idTokenParsed?: { auth_time?: number };
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

  it('reconhece o período máximo já na primeira leitura, pelo instante da autenticação', async () => {
    espiarCriacaoDoKeycloak(service).mockReturnValue({
      init: async () => true,
      authenticated: true,
      idTokenParsed: { auth_time: AUTENTICADO_EM },
      refreshTokenParsed: { iat: AUTENTICADO_EM, exp: AUTENTICADO_EM + PERIODO_MAXIMO_EM_SEGUNDOS },
    } as unknown as Keycloak);

    await service.init(configDeTeste);

    expect(service.prazoDaCredencial()?.limite).toBe('periodoMaximo');
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
