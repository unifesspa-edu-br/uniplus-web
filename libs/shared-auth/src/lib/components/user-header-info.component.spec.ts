import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal, computed } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { PROFILE_BASE_PATH } from '@uniplus/shared-auth/bootstrap';
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
    const login = vi.fn();

    const authServiceMock = {
      userProfile: signal(profile).asReadonly(),
      authenticated: signal(profile !== null).asReadonly(),
      hasRole: vi.fn((role: string) => profile?.roles.includes(role) ?? false),
      logout,
      login,
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
        { provide: PROFILE_BASE_PATH, useValue: 'http://api.test' },
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    const fixture: ComponentFixture<UserHeaderInfoComponent> =
      TestBed.createComponent(UserHeaderInfoComponent);
    fixture.detectChanges();
    return { fixture, logout, login };
  }

  it('exibe apenas o primeiro nome social + avatar no chip (sem username/perfil)', () => {
    const { fixture } = setup();
    const chip = fixture.nativeElement.querySelector<HTMLElement>('button.user-chip');
    const name = chip.querySelector<HTMLElement>('[data-testid="auth-user-display-name"]');
    const avatar = chip.querySelector<HTMLElement>('.user-chip__avatar');
    expect(name?.textContent?.trim()).toBe('Candidato');
    // Inicial pintada em ::before (ver shared-ui/styles/components.css) — SC 2.5.3.
    expect(avatar?.getAttribute('data-initials')).toBe('C');
    expect(avatar?.textContent?.trim()).toBe('');
    // O chip não repete username nem nome completo — a identidade completa vive no dropdown.
    expect(chip.textContent).not.toContain('@');
    expect(chip.textContent).not.toContain('Candidato Teste');
  });

  it('exibe username com prefixo @ no dropdown, não no chip', () => {
    const { fixture } = setup();
    const username = fixture.nativeElement.querySelector<HTMLElement>(
      '[data-testid="auth-user-username"]',
    );
    expect(username?.textContent).toContain('@candidato');
    // A linha de identidade pertence ao menu de conta, não ao chip do topbar.
    expect(username?.closest('.menu')).toBeTruthy();
    expect(username?.closest('.user-chip')).toBeNull();
  });

  it('exibe o nome completo no cabeçalho de identidade do dropdown', () => {
    const { fixture } = setup();
    const fullName = fixture.nativeElement.querySelector<HTMLElement>(
      '[data-testid="auth-user-full-name"]',
    );
    expect(fullName?.textContent?.trim()).toBe('Candidato Teste');
    expect(fullName?.closest('.menu__account')).toBeTruthy();
  });

  it('menu de conta expõe aria-label e o cabeçalho é role=presentation', () => {
    const { fixture } = setup();
    const menu = fixture.nativeElement.querySelector<HTMLElement>('.menu');
    expect(menu?.getAttribute('role')).toBe('menu');
    expect(menu?.getAttribute('aria-label')).toBe('Conta');
    const account = fixture.nativeElement.querySelector<HTMLElement>('.menu__account');
    expect(account?.getAttribute('role')).toBe('presentation');
    // O cabeçalho de identidade não é navegável — os menuitems são "Meu perfil" e "Sair", nessa ordem.
    const items = fixture.nativeElement.querySelectorAll('[role="menuitem"]');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Meu perfil');
    expect(items[1].textContent).toContain('Sair');
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

    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.menu__item--danger');
    btn.click();
    expect(logout).toHaveBeenCalledOnce();
  });

  it('exibe botão "Entrar" quando não há usuário autenticado, sem chip/menu de conta', () => {
    const { fixture } = setup(null);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent?.trim()).toBe('Entrar');
    expect(el.querySelector('button.user-chip')).toBeNull();
    expect(el.querySelector('[role="menu"]')).toBeNull();
    expect(el.textContent).not.toContain('Meu perfil');
  });

  describe('Meu perfil', () => {
    const resposta = {
      userId: 'abc-123',
      name: 'Usuário Candidato',
      email: 'candidato@teste.unifesspa.edu.br',
      cpf: '24843803480',
      nomeSocial: 'Candidato Teste',
      roles: ['candidato', 'offline_access'],
      timestamp: '2026-10-05T12:00:00Z',
    };

    function abrirPerfil() {
      const ctx = setup();
      const http = TestBed.inject(HttpTestingController);
      ctx.fixture.nativeElement.querySelector('button.user-chip').click();
      ctx.fixture.detectChanges();
      ctx.fixture.nativeElement.querySelector('[data-testid="auth-user-profile-item"]').click();
      ctx.fixture.detectChanges();
      return { ...ctx, http };
    }

    it('só consulta /api/profile/me depois de pedir o perfil', () => {
      const { fixture } = setup();
      const http = TestBed.inject(HttpTestingController);
      fixture.nativeElement.querySelector('button.user-chip').click();
      fixture.detectChanges();
      http.expectNone('http://api.test/api/profile/me');
      expect(fixture.nativeElement.querySelector('auth-user-profile-dialog')).toBeNull();
    });

    it('fecha o menu e abre o modal exibindo os dados retornados pela API', () => {
      const { fixture, http } = abrirPerfil();
      http.expectOne('http://api.test/api/profile/me').flush(resposta);
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.menu')?.hasAttribute('hidden')).toBe(true);
      const dados = el.querySelector('[data-testid="auth-profile-data"]');
      expect(dados?.textContent).toContain('Usuário Candidato');
      expect(dados?.textContent).toContain('Candidato Teste');
      expect(dados?.textContent).toContain('candidato@teste.unifesspa.edu.br');
      // CPF abre mascarado no padrão do Uni+ (***.999.999-**): sem os verificadores.
      expect(dados?.textContent).toContain('***.438.034-**');
      expect(dados?.textContent).not.toContain('248.');
      expect(dados?.textContent).not.toContain('-80');
      expect(dados?.textContent).toContain('Candidato');
      expect(dados?.textContent).not.toContain('offline_access');
    });

    it('revela e volta a ocultar o CPF pelo botão de olho', () => {
      const { fixture, http } = abrirPerfil();
      http.expectOne('http://api.test/api/profile/me').flush(resposta);
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      const toggle = el.querySelector<HTMLButtonElement>('[data-testid="auth-profile-cpf-toggle"]');
      const cpf = () => el.querySelector('[data-testid="auth-profile-cpf"]')?.textContent?.trim();
      expect(toggle?.getAttribute('aria-label')).toBe('Mostrar CPF');
      expect(toggle?.getAttribute('aria-pressed')).toBe('false');

      toggle?.click();
      fixture.detectChanges();
      expect(cpf()).toBe('248.438.034-80');
      expect(toggle?.getAttribute('aria-label')).toBe('Ocultar CPF');
      expect(toggle?.getAttribute('aria-pressed')).toBe('true');

      toggle?.click();
      fixture.detectChanges();
      expect(cpf()).toBe('***.438.034-**');
    });

    it('não oferece o botão de olho quando o CPF não tem 11 dígitos', () => {
      const { fixture, http } = abrirPerfil();
      http.expectOne('http://api.test/api/profile/me').flush({ ...resposta, cpf: '123' });
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('[data-testid="auth-profile-cpf-toggle"]')).toBeNull();
      expect(el.querySelector('[data-testid="auth-profile-cpf"]')?.textContent?.trim()).toBe(
        '***.***.***-**',
      );
    });

    it('volta a mascarar o CPF ao reabrir o modal', () => {
      const { fixture, http } = abrirPerfil();
      http.expectOne('http://api.test/api/profile/me').flush(resposta);
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      el.querySelector<HTMLButtonElement>('[data-testid="auth-profile-cpf-toggle"]')?.click();
      fixture.detectChanges();
      expect(el.querySelector('[data-testid="auth-profile-cpf"]')?.textContent?.trim()).toBe(
        '248.438.034-80',
      );

      el.querySelector('dialog')?.dispatchEvent(new Event('close'));
      fixture.detectChanges();
      el.querySelector<HTMLButtonElement>('button.user-chip')?.click();
      fixture.detectChanges();
      el.querySelector<HTMLButtonElement>('[data-testid="auth-user-profile-item"]')?.click();
      fixture.detectChanges();
      http.expectOne('http://api.test/api/profile/me').flush(resposta);
      fixture.detectChanges();

      expect(el.querySelector('[data-testid="auth-profile-cpf"]')?.textContent?.trim()).toBe(
        '***.438.034-**',
      );
    });

    it('fecha ao clicar fora do painel, mas não ao clicar dentro dele', () => {
      const { fixture, http } = abrirPerfil();
      http.expectOne('http://api.test/api/profile/me').flush(resposta);
      fixture.detectChanges();
      const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
      expect(dialog.open).toBe(true);

      dialog.querySelector<HTMLElement>('.uni-dialog__panel')?.click();
      expect(dialog.open).toBe(true);

      dialog.click();
      expect(dialog.open).toBe(false);
    });

    it('mostra mensagem de erro quando a API falha', () => {
      const { fixture, http } = abrirPerfil();
      http
        .expectOne('http://api.test/api/profile/me')
        .flush(null, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('[data-testid="auth-profile-error"]'),
      ).toBeTruthy();
    });

    it('desmonta o modal e devolve o foco ao chip quando ele fecha', () => {
      const { fixture, http } = abrirPerfil();
      http.expectOne('http://api.test/api/profile/me').flush(resposta);
      fixture.detectChanges();

      const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
      dialog.dispatchEvent(new Event('close'));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('auth-user-profile-dialog')).toBeNull();
      expect(document.activeElement).toBe(fixture.nativeElement.querySelector('button.user-chip'));
    });
  });

  it('chama authService.login() ao clicar em Entrar', () => {
    const { fixture, login } = setup(null);
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    btn.click();
    expect(login).toHaveBeenCalledOnce();
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
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.menu__item--danger');

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
