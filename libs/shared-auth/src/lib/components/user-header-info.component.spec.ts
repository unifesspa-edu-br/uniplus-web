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
import { rotuloDoPerfil, type PerfilConcedido } from '../models/perfil-concedido.model';
import { PerfisDeAcessoService, type EstadoDosPerfis } from '../services/perfis-de-acesso.service';

describe('UserHeaderInfoComponent', () => {
  const profileData: UserProfile = {
    id: 'abc-123',
    username: 'candidato',
    email: 'candidato@teste.unifesspa.edu.br',
    nomeCivil: 'Usuário Candidato',
    nomeSocial: 'Candidato Teste',
    cpf: '69959836371',
  };

  const estadoDosPerfis = signal<EstadoDosPerfis>('carregada');
  const concedidos = signal<readonly PerfilConcedido[]>([]);
  let responderRecarga: (resposta: unknown) => void = () => undefined;
  const recarregar = vi.fn(
    () =>
      new Promise<unknown>((resolver) => {
        responderRecarga = resolver;
      }),
  );

  function perfil(nome: string, sigla: string | null, id = nome): PerfilConcedido {
    return {
      concessaoId: `c-${id}`,
      perfilId: `p-${id}`,
      nome,
      escopoTipo: 'unidade',
      unidadeId: sigla === null ? null : `u-${sigla}`,
      unidadeSigla: sigla,
      unidadeNome: null,
      validaAte: null,
    };
  }

  function setup(profile: UserProfile | null = profileData) {
    const logout = vi.fn();
    const login = vi.fn();
    const atualizarPerfil = vi.fn();

    estadoDosPerfis.set('carregada');
    concedidos.set([]);
    recarregar.mockClear();
    const perfisMock = {
      estado: estadoDosPerfis.asReadonly(),
      perfis: concedidos.asReadonly(),
      rotulos: computed(() => concedidos().map(rotuloDoPerfil)),
      recarregar,
    } as unknown as PerfisDeAcessoService;

    const authServiceMock = {
      userProfile: signal(profile).asReadonly(),
      authenticated: signal(profile !== null).asReadonly(),
      logout,
      login,
      atualizarPerfil,
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
        { provide: PerfisDeAcessoService, useValue: perfisMock },
        { provide: PROFILE_BASE_PATH, useValue: 'http://api.test' },
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    const fixture: ComponentFixture<UserHeaderInfoComponent> =
      TestBed.createComponent(UserHeaderInfoComponent);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    return { fixture, host, logout, login, atualizarPerfil };
  }

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

  describe('Meu perfil', () => {
    const resposta = {
      userId: 'abc-123',
      name: 'Usuário Candidato',
      email: 'candidato@teste.unifesspa.edu.br',
      cpf: '69959836371',
      nomeSocial: 'Candidato Teste',
      perfis: [],
      timestamp: '2026-10-05T12:00:00Z',
    };

    function abrirPerfil() {
      const ctx = setup();
      ctx.fixture.nativeElement.querySelector('button.user-chip').click();
      ctx.fixture.detectChanges();
      ctx.fixture.nativeElement.querySelector('[data-testid="auth-user-profile-item"]').click();
      ctx.fixture.detectChanges();
      /** Entrega a resposta da consulta única que o serviço faz ao abrir o modal. */
      const responder = async (resposta: unknown) => {
        responderRecarga(resposta);
        await ctx.fixture.whenStable();
        ctx.fixture.detectChanges();
      };
      return { ...ctx, responder };
    }

    it('só consulta o perfil depois de pedir Meu perfil, e uma única vez', () => {
      const { fixture } = setup();
      fixture.nativeElement.querySelector('button.user-chip').click();
      fixture.detectChanges();
      expect(recarregar).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('auth-user-profile-dialog')).toBeNull();

      fixture.nativeElement.querySelector('[data-testid="auth-user-profile-item"]').click();
      fixture.detectChanges();

      expect(recarregar).toHaveBeenCalledOnce();
      expect(TestBed.inject(HttpTestingController).match(() => true)).toEqual([]);
    });

    it('fecha o menu e abre o modal exibindo os dados retornados pela API', async () => {
      const { fixture, responder } = abrirPerfil();
      await responder(resposta);

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.menu')?.hasAttribute('hidden')).toBe(true);
      const dados = el.querySelector('[data-testid="auth-profile-data"]');
      expect(dados?.textContent).toContain('Usuário Candidato');
      expect(dados?.textContent).toContain('Candidato Teste');
      expect(dados?.textContent).toContain('candidato@teste.unifesspa.edu.br');
      // CPF abre mascarado no padrão do Uni+ (***.999.999-**): sem os verificadores.
      expect(dados?.textContent).toContain('***.598.363-**');
      expect(dados?.textContent).not.toContain('699.');
      expect(dados?.textContent).not.toContain('-71');
    });

    it('oferece "Alterar nome social" quando a conta tem nome social e abre a atualização do perfil', async () => {
      const { fixture, atualizarPerfil, responder } = abrirPerfil();
      await responder(resposta);

      const acao = fixture.nativeElement.querySelector(
        '[data-testid="auth-profile-nome-social-acao"]',
      ) as HTMLButtonElement;
      expect(acao.textContent?.trim()).toBe('Alterar nome social');
      acao.click();
      expect(atualizarPerfil).toHaveBeenCalledTimes(1);
    });

    it('oferece "Cadastrar nome social" quando a conta não tem nome social', async () => {
      const { fixture, responder } = abrirPerfil();
      await responder({ ...resposta, nomeSocial: null });

      const acao = fixture.nativeElement.querySelector(
        '[data-testid="auth-profile-nome-social-acao"]',
      );
      expect(acao?.textContent?.trim()).toBe('Cadastrar nome social');
    });

    it('anuncia o carregamento, mas não lê os dados do perfil, com o CPF, sozinho', async () => {
      const { fixture, responder } = abrirPerfil();
      const el: HTMLElement = fixture.nativeElement;
      expect(
        el.querySelector('[data-testid="auth-profile-loading"]')?.closest('[aria-live]'),
      ).not.toBeNull();

      await responder(resposta);

      expect(
        el.querySelector('[data-testid="auth-profile-data"]')?.closest('[aria-live]'),
      ).toBeNull();
    });

    it('revela e volta a ocultar o CPF pelo botão de olho', async () => {
      const { fixture, responder } = abrirPerfil();
      await responder(resposta);

      const el: HTMLElement = fixture.nativeElement;
      const toggle = el.querySelector<HTMLButtonElement>('[data-testid="auth-profile-cpf-toggle"]');
      const cpf = () => el.querySelector('[data-testid="auth-profile-cpf"]')?.textContent?.trim();
      expect(toggle?.getAttribute('aria-label')).toBe('Mostrar CPF');
      expect(toggle?.getAttribute('aria-pressed')).toBe('false');

      toggle?.click();
      fixture.detectChanges();
      expect(cpf()).toBe('699.598.363-71');
      // O nome não muda: o estado é dito só pelo aria-pressed.
      expect(toggle?.getAttribute('aria-label')).toBe('Mostrar CPF');
      expect(toggle?.getAttribute('aria-pressed')).toBe('true');

      toggle?.click();
      fixture.detectChanges();
      expect(cpf()).toBe('***.598.363-**');
    });

    it('não oferece o botão de olho quando o CPF não tem 11 dígitos', async () => {
      const { fixture, responder } = abrirPerfil();
      await responder({ ...resposta, cpf: '123' });

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('[data-testid="auth-profile-cpf-toggle"]')).toBeNull();
      expect(el.querySelector('[data-testid="auth-profile-cpf"]')?.textContent?.trim()).toBe(
        '***.***.***-**',
      );
    });

    it('volta a mascarar o CPF ao reabrir o modal', async () => {
      const { fixture, responder } = abrirPerfil();
      await responder(resposta);
      const el: HTMLElement = fixture.nativeElement;
      el.querySelector<HTMLButtonElement>('[data-testid="auth-profile-cpf-toggle"]')?.click();
      fixture.detectChanges();
      expect(el.querySelector('[data-testid="auth-profile-cpf"]')?.textContent?.trim()).toBe(
        '699.598.363-71',
      );

      el.querySelector('dialog')?.dispatchEvent(new Event('close'));
      fixture.detectChanges();
      el.querySelector<HTMLButtonElement>('button.user-chip')?.click();
      fixture.detectChanges();
      el.querySelector<HTMLButtonElement>('[data-testid="auth-user-profile-item"]')?.click();
      fixture.detectChanges();
      await responder(resposta);

      expect(el.querySelector('[data-testid="auth-profile-cpf"]')?.textContent?.trim()).toBe(
        '***.598.363-**',
      );
    });

    it('fecha ao clicar fora do painel, mas não ao clicar dentro dele', async () => {
      const { fixture, responder } = abrirPerfil();
      await responder(resposta);
      const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
      expect(dialog.open).toBe(true);

      dialog.querySelector<HTMLElement>('.uni-dialog__panel')?.click();
      expect(dialog.open).toBe(true);

      dialog.click();
      expect(dialog.open).toBe(false);
    });

    function perfisDoModal(fixture: ComponentFixture<UserHeaderInfoComponent>): HTMLElement {
      const el = fixture.nativeElement.querySelector('[data-testid="auth-profile-perfis"]');
      if (el === null) throw new Error('perfis do modal não renderizados');
      return el;
    }

    it('lista os perfis com o escopo e o prazo "até dd/mm/aaaa" quando há prazo', async () => {
      const { fixture, responder } = abrirPerfil();
      await responder(resposta);
      concedidos.set([
        {
          ...perfil('Gestor de processo seletivo', 'CEPS'),
          validaAte: '2026-12-31T23:59:00-03:00',
        },
        perfil('Consulta institucional', null),
      ]);
      fixture.detectChanges();

      const itens = perfisDoModal(fixture).querySelectorAll('li');
      expect(itens[0]?.textContent).toContain('Gestor de processo seletivo');
      expect(itens[0]?.textContent).toContain('CEPS');
      expect(itens[0]?.textContent).toContain('até 31/12/2026');
      expect(itens[1]?.textContent).not.toContain('até');
    });

    it('mostra "Unidade não identificada" para o perfil numa unidade que não existe mais', async () => {
      const { fixture, responder } = abrirPerfil();
      await responder(resposta);
      concedidos.set([perfil('Gestor de processo seletivo', null)]);
      fixture.detectChanges();

      expect(perfisDoModal(fixture).textContent).toContain('Unidade não identificada');
    });

    it('mostra "Nenhum perfil de acesso" e nada de "Candidato" a quem não tem perfil', async () => {
      const { fixture, responder } = abrirPerfil();
      await responder(resposta);

      expect(perfisDoModal(fixture).textContent).toContain('Nenhum perfil de acesso');
      expect(perfisDoModal(fixture).textContent).not.toContain('Candidato');
    });

    it('distingue a falha da consulta de perfis de "sem perfil"', async () => {
      const { fixture, responder } = abrirPerfil();
      await responder(resposta);
      estadoDosPerfis.set('indisponivel');
      fixture.detectChanges();

      expect(perfisDoModal(fixture).textContent).toContain(
        'Não foi possível carregar os perfis de acesso',
      );
      expect(perfisDoModal(fixture).textContent).not.toContain('Nenhum perfil de acesso');
    });

    it('mostra mensagem de erro quando a API falha', async () => {
      const { fixture, responder } = abrirPerfil();
      await responder(null);
      expect(
        fixture.nativeElement.querySelector('[data-testid="auth-profile-error"]'),
      ).toBeTruthy();
    });

    it('desmonta o modal e devolve o foco ao chip quando ele fecha', async () => {
      const { fixture, responder } = abrirPerfil();
      await responder(resposta);

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

function firstNameFrom(name: string): string {
  return name.trim().split(/\s+/u)[0] ?? '';
}
