import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

interface KeycloakLike {
  updateToken: (minValidity: number) => Promise<boolean>;
  logout: () => Promise<void>;
  token?: string;
  refreshToken?: string;
}

const RECUSA_DA_RENOVACAO = new Error('Server responded with an invalid status.');
const REUSO_EXCEDIDO = {
  error: 'invalid_grant',
  error_description: 'Maximum allowed refresh token reuse exceeded',
};

/**
 * Injeta um duplo de Keycloak no AuthService sem passar por `init()`
 * (que depende do DOM e de rede). Usa a propriedade privada `keycloak`
 * através de um cast controlado.
 */
function attachFakeKeycloak(
  service: AuthService,
  fake: Pick<KeycloakLike, 'updateToken'> & Partial<KeycloakLike>,
): void {
  const keycloak: KeycloakLike = { logout: async () => undefined, ...fake };
  (service as unknown as { keycloak: KeycloakLike }).keycloak = keycloak;
}

function renovacaoQueFalha(erro: unknown): () => Promise<boolean> {
  return async () => {
    throw erro;
  };
}

function renovacaoDemorada(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    setTimeout(() => resolve(true), 10);
  });
}

describe('AuthService — serialização de refreshToken', () => {
  let service: AuthService;

  function marcarComoAutenticado(): void {
    (service as unknown as { _authenticated: { set(v: boolean): void } })._authenticated.set(true);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  it('compartilha uma única chamada de updateToken quando refreshToken é disparado em paralelo', async () => {
    const updateToken = vi.fn(renovacaoDemorada);
    attachFakeKeycloak(service, { updateToken });

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
    attachFakeKeycloak(service, { updateToken });

    await service.refreshToken(30);
    await service.refreshToken(30);

    expect(updateToken).toHaveBeenCalledTimes(2);
  });

  it('encerra a sessão, sem logout nem login automáticos, quando a recusa leva a credencial de renovação', async () => {
    const logout = vi.fn(async () => undefined);
    attachFakeKeycloak(service, { updateToken: renovacaoQueFalha(RECUSA_DA_RENOVACAO), logout });

    const result = await service.refreshToken(30);

    expect(result).toBe(false);
    expect(service.sessaoEncerrada()).toBe(true);
    expect(service.authenticated()).toBe(false);
    expect(logout).not.toHaveBeenCalled();
  });

  it('encerra a sessão com a mesma recusa mesmo quando o erro traz o texto de reuso', async () => {
    attachFakeKeycloak(service, { updateToken: renovacaoQueFalha(REUSO_EXCEDIDO) });

    await service.refreshToken(30);

    expect(service.sessaoEncerrada()).toBe(true);
  });

  it('mantém a sessão em falha passageira, enquanto o cliente guarda a credencial de renovação', async () => {
    marcarComoAutenticado();
    const updateToken = renovacaoQueFalha(new Error('Network request failed'));
    attachFakeKeycloak(service, { updateToken, refreshToken: 'credencial-do-teste' });

    const result = await service.refreshToken(30);

    expect(result).toBe(false);
    expect(service.sessaoEncerrada()).toBe(false);
    expect(service.authenticated()).toBe(true);
  });

  it('libera a promise em voo mesmo quando o refresh lança', async () => {
    attachFakeKeycloak(service, { updateToken: renovacaoQueFalha(new Error('Network fail')) });

    await service.refreshToken(30);
    expect(service._getRefreshInFlight()).toBeNull();
  });

  describe('sessao', () => {
    it('é nula sem sessão autenticada', () => {
      expect(service.sessao()).toBeNull();
    });

    it('muda a cada renovação efetiva do token e não muda quando o token segue válido', async () => {
      marcarComoAutenticado();
      const antes = service.sessao();
      attachFakeKeycloak(service, { updateToken: async () => false });

      await service.refreshToken(30);
      expect(service.sessao()).toBe(antes);

      attachFakeKeycloak(service, { updateToken: async () => true });
      await service.refreshToken(30);
      expect(service.sessao()).not.toBe(antes);
    });

    it('volta a ser nula quando a renovação falha e derruba a sessão', async () => {
      marcarComoAutenticado();
      attachFakeKeycloak(service, { updateToken: renovacaoQueFalha(new Error('Network fail')) });

      await service.refreshToken(30);

      expect(service.sessao()).toBeNull();
    });
  });
});
