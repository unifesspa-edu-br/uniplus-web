import { TestBed } from '@angular/core/testing';
import type Keycloak from 'keycloak-js';
import { AuthConfig } from '../models/auth-config.model';
import { AuthService } from './auth.service';
import { espiarCriacaoDoKeycloak, instalarBase } from './auth.service.testing';

const config: AuthConfig = {
  issuerUrl: 'http://localhost:8080/realms/unifesspa',
  clientId: 'selecao-web',
  antecedenciaDaRenovacaoEmSegundos: 60,
  allowedUrls: ['http://localhost:5000/api/v1'],
};

function iniciar(autenticado: boolean) {
  const login = vi.fn(async () => undefined);
  const logout = vi.fn(async () => undefined);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({});
  const service = TestBed.inject(AuthService);
  espiarCriacaoDoKeycloak(service).mockReturnValue({
    init: async () => autenticado,
    authenticated: autenticado,
    tokenParsed: {},
    login,
    logout,
  } as unknown as Keycloak);
  return { service, login, logout };
}

describe('AuthService — entrar de novo com uma sessão nova', () => {
  beforeEach(() => instalarBase('http://localhost:3000/selecao/'));
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('encerra a sessão no provedor e volta à rota com o parâmetro', async () => {
    const { service, logout } = iniciar(true);
    await service.init(config);

    await service.encerrarParaEntrarDeNovo('/processo-seletivo/novo');

    expect(logout).toHaveBeenCalledWith({
      redirectUri: 'http://localhost:3000/selecao/processo-seletivo/novo?entrarDeNovo=1',
    });
  });

  it('na volta sem sessão, retira o parâmetro do histórico e vai ao login pela rota limpa', async () => {
    window.history.replaceState(null, '', '/selecao/processos?busca=a&entrarDeNovo=1');
    const { service, login } = iniciar(false);

    await service.init(config);

    expect(login).toHaveBeenCalledWith({
      redirectUri: `${window.location.origin}/selecao/processos?busca=a`,
    });
    expect(window.location.search).toBe('?busca=a');
  });

  it('na volta com sessão (outra aplicação entrou antes), só retira o parâmetro da URL', async () => {
    window.history.replaceState(null, '', '/selecao/processos?entrarDeNovo=1');
    const { service, login } = iniciar(true);

    await service.init(config);

    expect(login).not.toHaveBeenCalled();
    expect(window.location.search).toBe('');
  });

  it('sem o parâmetro, a partida não mexe na URL nem chama o login', async () => {
    window.history.replaceState(null, '', '/selecao/processos?busca=a');
    const { service, login } = iniciar(false);

    await service.init(config);

    expect(login).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?busca=a');
  });
});
