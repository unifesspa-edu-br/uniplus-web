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
        return profile.nomeSocial || profile.nomeCivil;
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

    const fixture: ComponentFixture<UserHeaderInfoComponent> = TestBed.createComponent(UserHeaderInfoComponent);
    fixture.detectChanges();
    return { fixture, logout };
  }

  it('exibe nome social do usuário autenticado', () => {
    const { fixture } = setup();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Candidato Teste');
  });

  it('exibe username com prefixo @', () => {
    const { fixture } = setup();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('@candidato');
  });

  it('exibe roles do realm', () => {
    const { fixture } = setup();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('candidato');
  });

  it('exibe múltiplas roles separadas por vírgula', () => {
    const multiRoleProfile: UserProfile = {
      ...profileData,
      roles: ['admin', 'gestor'],
    };
    const { fixture } = setup(multiRoleProfile);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('admin, gestor');
  });

  it('exibe nome civil quando nome social é vazio', () => {
    const semNomeSocial: UserProfile = {
      ...profileData,
      nomeSocial: undefined,
    };
    const { fixture } = setup(semNomeSocial);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Usuário Candidato');
  });

  it('renderiza botão de logout com aria-label', () => {
    const { fixture } = setup();
    const btn = fixture.nativeElement.querySelector('button[aria-label="Sair da aplicação"]');
    expect(btn).toBeTruthy();
    expect(btn.textContent.trim()).toBe('Sair');
  });

  it('chama authService.logout() ao clicar em Sair', () => {
    const { fixture, logout } = setup();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
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
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Usuário Candidato');
    expect(el.textContent).not.toContain('Candidato Teste');
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

  it('exibe roles com underscore ou caractere especial sem quebrar', () => {
    const rolesEspeciais: UserProfile = {
      ...profileData,
      roles: ['offline_access', 'uma-role-composta'],
    };
    const { fixture } = setup(rolesEspeciais);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('offline_access, uma-role-composta');
  });

  it('dispara logout() a cada clique (sem debounce)', () => {
    const { fixture, logout } = setup();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    btn.click();
    btn.click();
    expect(logout).toHaveBeenCalledTimes(2);
  });
});
