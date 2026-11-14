import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { type EstadoDosPerfis } from '../services/perfis-de-acesso.service';
import { type UserProfile } from '../models/user.model';
import {
  concedidos,
  estadoDosPerfis,
  perfil,
  profileData,
  setup,
} from './user-header-info.component.testing';

describe('UserHeaderInfoComponent', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('exibe apenas o primeiro nome social + avatar no chip (sem username/perfil)', () => {
    const { host } = setup();
    const chip = host.querySelector<HTMLElement>('button.user-chip');
    if (chip === null) throw new Error('chip do usuário não renderizado');
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
    const { host } = setup();
    const username = host.querySelector<HTMLElement>('[data-testid="auth-user-username"]');
    expect(username?.textContent).toContain('@candidato');
    // A linha de identidade pertence ao menu de conta, não ao chip do topbar.
    expect(username?.closest('.menu')).toBeTruthy();
    expect(username?.closest('.user-chip')).toBeNull();
  });

  it('exibe o nome completo no cabeçalho de identidade do dropdown', () => {
    const { host } = setup();
    const fullName = host.querySelector<HTMLElement>('[data-testid="auth-user-full-name"]');
    expect(fullName?.textContent?.trim()).toBe('Candidato Teste');
    expect(fullName?.closest('.menu__account')).toBeTruthy();
  });

  it('menu de conta expõe aria-label e o cabeçalho é role=presentation', () => {
    const { fixture, host } = setup();
    const menu = host.querySelector<HTMLElement>('.menu');
    expect(menu?.getAttribute('role')).toBe('menu');
    expect(menu?.getAttribute('aria-label')).toBe('Conta');
    const account = host.querySelector<HTMLElement>('.menu__account');
    expect(account?.getAttribute('role')).toBe('presentation');
    // O cabeçalho de identidade não é navegável — os menuitems são "Meu perfil" e "Sair", nessa ordem.
    const items = fixture.nativeElement.querySelectorAll('[role="menuitem"]');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Meu perfil');
    expect(items[1].textContent).toContain('Sair');
  });

  describe('perfis de acesso no menu', () => {
    function grupo(host: HTMLElement): HTMLElement | null {
      return host.querySelector<HTMLElement>('[role="menu"] [role="group"]');
    }

    it('lista cada perfil em texto não interativo dentro de um grupo rotulado, na ordem recebida', () => {
      const { fixture } = setup();
      concedidos.set([
        { ...perfil('Consulta institucional', null), escopoTipo: 'instituicao' },
        perfil('Gestor de processo seletivo', 'CEPS'),
      ]);
      fixture.detectChanges();

      const g = grupo(fixture.nativeElement);
      expect(g?.getAttribute('aria-label')).toBe('Perfis de acesso');
      expect(g?.textContent).toContain('Consulta institucional — Instituição');
      expect(g?.textContent).toContain('Gestor de processo seletivo — CEPS');
      expect(g?.textContent?.indexOf('Consulta')).toBeLessThan(
        g?.textContent?.indexOf('Gestor') ?? 0,
      );
      expect(g?.querySelector('button, a, [role="menuitem"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('[role="menu"] ul, [role="menu"] ol')).toBeNull();
    });

    it('mostra só @usuário na linha da conta, sem papel do token', () => {
      const { host } = setup();
      const meta = host.querySelector('[data-testid="auth-user-username"]');

      expect(meta?.textContent?.trim()).toBe('@candidato');
      expect(host.textContent).not.toContain('Candidato ·');
    });

    it('não mostra o grupo nem aviso quando a pessoa não tem perfil', () => {
      const { host } = setup();

      expect(grupo(host)).toBeNull();
      expect(host.querySelector('[data-testid="auth-user-perfis-indisponiveis"]')).toBeNull();
    });

    it.each<EstadoDosPerfis>(['carregando', 'indisponivel'])(
      'mostra "Perfis indisponíveis" com a consulta em estado %s',
      (estado) => {
        const { fixture, host } = setup();
        estadoDosPerfis.set(estado);
        fixture.detectChanges();

        expect(
          host.querySelector('[data-testid="auth-user-perfis-indisponiveis"]')?.textContent,
        ).toContain('Perfis indisponíveis');
        expect(grupo(host)).toBeNull();
      },
    );
  });

  it('exibe apenas o primeiro nome civil quando nome social é vazio', () => {
    const semNomeSocial: UserProfile = {
      ...profileData,
      nomeSocial: undefined,
    };
    const { host } = setup(semNomeSocial);
    const name = host.querySelector<HTMLElement>('[data-testid="auth-user-display-name"]');
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

  it('chama authService.login() ao clicar em Entrar', () => {
    const { fixture, login } = setup(null);
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    btn.click();
    expect(login).toHaveBeenCalledOnce();
  });

  // --- Edge cases ---

  it('exibe nome civil quando nomeSocial é string vazia (não undefined)', () => {
    const nomeSocialVazio: UserProfile = {
      ...profileData,
      nomeSocial: '',
    };
    const { host } = setup(nomeSocialVazio);
    const name = host.querySelector<HTMLElement>('[data-testid="auth-user-display-name"]');
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
