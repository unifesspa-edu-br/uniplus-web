import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { AuthService } from './auth.service';
import { UserContextService } from './user-context.service';
import type { UserProfile } from '../models/user.model';

// Stub mínimo do AuthService — exercita o contrato consumido por
// UserContextService (userProfile, authenticated), sem subir keycloak-js.
class AuthServiceStub {
  readonly userProfile = signal<UserProfile | null>(null);
  readonly authenticated = signal(false);
}

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    username: 'usuario',
    email: 'usuario@exemplo.com',
    nomeCivil: 'Maria das Dores',
    cpf: '33434225927',
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

  describe('displayName — prioridade nome social sobre nome civil (UNI-REQ-0032)', () => {
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
      // A prioridade do nome social manda usá-lo, mas string com só espaços não
      // conta como preenchida — usuário cadastrou e depois apagou. O pin
      // garante que `'   '.trim() === ''` continua caindo no fallback.
      authStub.userProfile.set(
        makeProfile({ nomeCivil: 'Carlos Pereira', nomeSocial: '   ' }),
      );
      expect(service.displayName()).toBe('Carlos Pereira');
    });
  });

  describe('firstDisplayName — primeiro nome para superfícies compactas', () => {
    it('retorna string vazia quando não há perfil', () => {
      expect(service.firstDisplayName()).toBe('');
    });

    it('retorna apenas o primeiro nome social quando preenchido', () => {
      authStub.userProfile.set(
        makeProfile({ nomeCivil: 'Usuário Candidato', nomeSocial: 'Candidato Teste' }),
      );

      expect(service.firstDisplayName()).toBe('Candidato');
    });

    it('retorna apenas o primeiro nome civil quando nome social está ausente', () => {
      authStub.userProfile.set(makeProfile({ nomeSocial: undefined }));

      expect(service.firstDisplayName()).toBe('Maria');
    });

    it('normaliza espaços excedentes antes de extrair o primeiro nome', () => {
      authStub.userProfile.set(
        makeProfile({ nomeCivil: '  Maria   das Dores  ', nomeSocial: undefined }),
      );

      expect(service.firstDisplayName()).toBe('Maria');
    });

    it('mantém nome único sem alteração', () => {
      authStub.userProfile.set(makeProfile({ nomeCivil: 'Madonna', nomeSocial: undefined }));

      expect(service.firstDisplayName()).toBe('Madonna');
    });
  });
});
