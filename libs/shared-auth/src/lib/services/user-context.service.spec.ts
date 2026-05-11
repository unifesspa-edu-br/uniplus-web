import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { AuthService } from './auth.service';
import { UserContextService } from './user-context.service';
import type { UserProfile } from '../models/user.model';

// Stub mínimo do AuthService — exercita o contrato consumido por
// UserContextService (userProfile, authenticated, hasRole), sem subir
// keycloak-js. Mantém o teste rápido e isolado: o objetivo é provar a
// lógica de derivação do contexto, não a integração com OIDC.
//
// O método `hasRole` é resolvido em duas camadas, em ordem de precedência:
// 1. Se `hasRoleByLogin` foi configurado, ele decide por login (permite
//    cenários como "só o role X bate").
// 2. Caso contrário, devolve `hasRoleResult` (default uniforme).
// Isso unifica os 2 padrões de mock e mantém a contagem de chamadas
// centralizada em `hasRoleCalls`.
class AuthServiceStub {
  readonly userProfile = signal<UserProfile | null>(null);
  readonly authenticated = signal(false);
  readonly hasRoleCalls: string[] = [];
  hasRoleResult = false;
  hasRoleByLogin: ((role: string) => boolean) | null = null;

  hasRole(role: string): boolean {
    this.hasRoleCalls.push(role);
    return this.hasRoleByLogin?.(role) ?? this.hasRoleResult;
  }
}

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    username: 'usuario',
    email: 'usuario@exemplo.com',
    nomeCivil: 'Maria das Dores',
    cpf: '52998224725',
    roles: ['candidato'],
    ...overrides,
  };
}

describe('UserContextService', () => {
  let service: UserContextService;
  let authStub: AuthServiceStub;

  beforeEach(() => {
    authStub = new AuthServiceStub();
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: authStub }],
    });
    service = TestBed.inject(UserContextService);
  });

  describe('user e isAuthenticated — proxy direto do AuthService', () => {
    it('expõe userProfile null e isAuthenticated false no estado inicial', () => {
      expect(service.user()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
    });

    it('reflete autenticação e perfil quando o AuthService atualiza', () => {
      const profile = makeProfile();
      authStub.userProfile.set(profile);
      authStub.authenticated.set(true);

      expect(service.user()).toBe(profile);
      expect(service.isAuthenticated()).toBe(true);
    });
  });

  describe('displayName — prioridade nome social sobre nome civil (RN02)', () => {
    it('retorna string vazia quando não há perfil', () => {
      expect(service.displayName()).toBe('');
    });

    it('retorna nome civil quando nome social está ausente', () => {
      authStub.userProfile.set(makeProfile({ nomeSocial: undefined }));
      expect(service.displayName()).toBe('Maria das Dores');
    });

    it('prioriza nome social quando preenchido', () => {
      authStub.userProfile.set(
        makeProfile({ nomeCivil: 'João Silva', nomeSocial: 'Joana Silva' }),
      );
      expect(service.displayName()).toBe('Joana Silva');
    });

    it('cai para nome civil quando nome social é só espaços (trim)', () => {
      // RN02 manda priorizar nome social, mas string com só espaços não
      // conta como preenchida — usuário cadastrou e depois apagou. O pin
      // garante que `'   '.trim() === ''` continua caindo no fallback.
      authStub.userProfile.set(
        makeProfile({ nomeCivil: 'Carlos Pereira', nomeSocial: '   ' }),
      );
      expect(service.displayName()).toBe('Carlos Pereira');
    });
  });

  describe('hasRole / hasAnyRole — delegação ao AuthService', () => {
    it('hasRole delega a chamada para AuthService com o mesmo role', () => {
      authStub.hasRoleResult = true;

      const resultado = service.hasRole('admin');

      expect(resultado).toBe(true);
      expect(authStub.hasRoleCalls).toEqual(['admin']);
    });

    it('hasAnyRole retorna true quando pelo menos um role bate', () => {
      // Simula: usuário é "gestor" mas tenta hasAnyRole('admin','gestor').
      // O stub responde true só para "gestor" — provamos curto-circuito
      // sem ler nenhuma chamada extra.
      authStub.hasRoleByLogin = (role) => role === 'gestor';

      const resultado = service.hasAnyRole('admin', 'gestor', 'avaliador');

      expect(resultado).toBe(true);
      // `Array.prototype.some` deve parar no primeiro true — não chamou
      // o terceiro role.
      expect(authStub.hasRoleCalls).toEqual(['admin', 'gestor']);
    });

    it('hasAnyRole retorna false quando nenhum role bate', () => {
      authStub.hasRoleResult = false;

      const resultado = service.hasAnyRole('admin', 'gestor');

      expect(resultado).toBe(false);
      expect(authStub.hasRoleCalls).toEqual(['admin', 'gestor']);
    });

    it('hasAnyRole com array vazio retorna false sem chamar AuthService', () => {
      const resultado = service.hasAnyRole();

      expect(resultado).toBe(false);
      expect(authStub.hasRoleCalls).toEqual([]);
    });
  });
});
