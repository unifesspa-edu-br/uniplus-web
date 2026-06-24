import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal, computed } from '@angular/core';
import { UserHeaderInfoComponent } from './user-header-info.component';
import { AuthService } from '../services/auth.service';
import { UserContextService } from '../services/user-context.service';
import { UserProfile } from '../models/user.model';

describe('UserHeaderInfoComponent', () => {
  const profileData: UserProfile = {
    id: 'abc-123',
    username: 'candidato',
    email: 'candidato@teste.unifesspa.edu.br',
    nomeCivil: 'Usuário Candidato',
    nomeSocial: 'Candidato Teste',
    cpf: '24843803480',
    roles: ['candidato'],
  };

  function setup(profile: UserProfile | null = profileData) {
    const logout = vi.fn();

    const authServiceMock = {
      userProfile: signal(profile).asReadonly(),
      authenticated: signal(profile !== null).asReadonly(),
      hasRole: vi.fn((role: string) => profile?.roles.includes(role) ?? false),
      logout,
    } as unknown as AuthService;

    const userContextMock = {
      user: signal(profile).asReadonly(),
      displayName: computed(() => {
        if (!profile) return '';
        return profile.nomeSocial?.trim() || profile.nomeCivil;
      }),
      firstDisplayName: computed(() => {
        if (!profile) return '';
        return firstNameFrom(profile.nomeSocial?.trim() || profile.nomeCivil);
      }),
      isAuthenticated: signal(profile !== null).asReadonly(),
    } as unknown as UserContextService;

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [UserHeaderInfoComponent],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: UserContextService, useValue: userContextMock },
      ],
    });

    const fixture: ComponentFixture<UserHeaderInfoComponent> =
      TestBed.createComponent(UserHeaderInfoComponent);
    fixture.detectChanges();
    return { fixture, logout };
  }

  it('exibe apenas o primeiro nome social do usuário autenticado', () => {
    const { fixture } = setup();
    const name = fixture.nativeElement.querySelector<HTMLElement>(
      '[data-testid="auth-user-display-name"]',
    );
    const avatar = fixture.nativeElement.querySelector<HTMLElement>('.user-chip__avatar');
    expect(name?.textContent?.trim()).toBe('Candidato');
    expect(avatar?.textContent?.trim()).toBe('C');
  });

  it('exibe username com prefixo @', () => {
    const { fixture } = setup();
    const username = fixture.nativeElement.querySelector<HTMLElement>(
      '[data-testid="auth-user-username"]',
    );
    expect(username?.textContent).toContain('@candidato');
  });

  it('exibe rótulos pt-BR das roles do realm', () => {
    const { fixture } = setup();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Candidato');
  });

  it('exibe rótulo pt-BR legível para a role plataforma-admin', () => {
    const plataformaAdminProfile: UserProfile = {
      ...profileData,
      roles: ['plataforma-admin'],
    };
    const { fixture } = setup(plataformaAdminProfile);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Administrador da Plataforma');
    expect(el.textContent).not.toContain('plataforma-admin');
  });

  it('exibe múltiplos rótulos de roles separados por vírgula', () => {
    const multiRoleProfile: UserProfile = {
      ...profileData,
      roles: ['admin', 'gestor'],
    };
    const { fixture } = setup(multiRoleProfile);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Administrador, Gestor');
  });

  it('exibe apenas o primeiro nome civil quando nome social é vazio', () => {
    const semNomeSocial: UserProfile = {
      ...profileData,
      nomeSocial: undefined,
    };
    const { fixture } = setup(semNomeSocial);
    const name = fixture.nativeElement.querySelector<HTMLElement>(
      '[data-testid="auth-user-display-name"]',
    );
    expect(name?.textContent?.trim()).toBe('Usuário');
  });

  it('renderiza trigger de menu de conta conforme contrato DS', () => {
    const { fixture } = setup();
    const btn = fixture.nativeElement.querySelector('button.user-chip');
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-haspopup')).toBe('menu');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('aria-controls')).toMatch(/^auth-user-menu-/);
    expect(btn.getAttribute('aria-label')).toBe('Abrir menu da conta de Candidato Teste');
  });

  it('chama authService.logout() ao clicar em Sair', () => {
    const { fixture, logout } = setup();
    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('button.user-chip');
    trigger.click();
    fixture.detectChanges();

    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('[role="menuitem"]');
    btn.click();
    expect(logout).toHaveBeenCalledOnce();
  });

  it('renderiza vazio quando não há usuário autenticado', () => {
    const { fixture } = setup(null);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent?.trim()).toBe('');
    expect(el.querySelector('button')).toBeNull();
  });

  it('não exibe seção de roles quando lista está vazia', () => {
    const semRoles: UserProfile = {
      ...profileData,
      roles: [],
    };
    const { fixture } = setup(semRoles);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('@candidato');
    expect(el.textContent).not.toContain('·');
  });

  // --- Edge cases ---

  it('exibe nome civil quando nomeSocial é string vazia (não undefined)', () => {
    const nomeSocialVazio: UserProfile = {
      ...profileData,
      nomeSocial: '',
    };
    const { fixture } = setup(nomeSocialVazio);
    const name = fixture.nativeElement.querySelector<HTMLElement>(
      '[data-testid="auth-user-display-name"]',
    );
    expect(name?.textContent?.trim()).toBe('Usuário');
  });

  it('não quebra quando nomeSocial e nomeCivil são ambos vazios', () => {
    const semNome: UserProfile = {
      ...profileData,
      nomeSocial: undefined,
      nomeCivil: '',
    };
    const { fixture } = setup(semNome);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('button')).toBeTruthy();
    expect(el.textContent).toContain('@candidato');
  });

  it('exibe @ mesmo quando username é string vazia', () => {
    const semUsername: UserProfile = {
      ...profileData,
      username: '',
    };
    const { fixture } = setup(semUsername);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('@');
    expect(el.querySelector('button')).toBeTruthy();
  });

  it('filtra roles internas do Keycloak sem quebrar', () => {
    const rolesInternas: UserProfile = {
      ...profileData,
      roles: ['candidato', 'offline_access', 'uma_authorization'],
    };
    const { fixture } = setup(rolesInternas);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Candidato');
    expect(el.textContent).not.toContain('offline_access');
    expect(el.textContent).not.toContain('uma_authorization');
  });

  it('dispara logout() a cada clique (sem debounce)', () => {
    const { fixture, logout } = setup();
    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('button.user-chip');
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('[role="menuitem"]');

    trigger.click();
    fixture.detectChanges();
    btn.click();

    trigger.click();
    fixture.detectChanges();
    btn.click();

    expect(logout).toHaveBeenCalledTimes(2);
  });
});

function firstNameFrom(name: string): string {
  return name.trim().split(/\s+/u)[0] ?? '';
}
