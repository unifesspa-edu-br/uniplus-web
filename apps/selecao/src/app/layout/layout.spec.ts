import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService, UserContextService } from '@uniplus/shared-auth/bootstrap';
import { AppConfigService } from '@uniplus/shared-data/config';
import { LayoutComponent } from './layout';

const papeis = signal<readonly string[]>([]);
const configuracao = signal<{ acompanhamentoValidacaoHabilitada?: boolean } | null>(null);
const authServiceStub = { roles: papeis, logout: () => undefined };
const userContextStub = {
  user: signal({ id: 'u-1', nome: 'Admin Teste', email: 'admin@teste.br', roles: [] }),
  displayName: signal('Admin Teste'),
  firstDisplayName: signal('Admin'),
};

/**
 * A navegação tem de espelhar os `roleGuard` das rotas: item visível que o
 * guard recusa é um clique que sempre termina em `/acesso-negado`.
 */
describe('LayoutComponent — navegação por papel', () => {
  beforeEach(async () => {
    configuracao.set(null);
    await TestBed.configureTestingModule({
      imports: [LayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceStub },
        { provide: UserContextService, useValue: userContextStub },
        { provide: AppConfigService, useValue: { config: configuracao } },
      ],
    }).compileComponents();
  });

  function rotulosDeNavegacao(seletor = 'nav a'): string[] {
    const fixture = TestBed.createComponent(LayoutComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    return Array.from(host.querySelectorAll(seletor) as NodeListOf<HTMLAnchorElement>)
      .map((a) => a.textContent?.trim() ?? '')
      .filter((texto) => texto.length > 0);
  }

  it('oferece o cadastro do certame a quem administra a plataforma', () => {
    papeis.set(['plataforma-admin']);

    expect(rotulosDeNavegacao().join(' | ')).toContain('Processo seletivo');
  });

  it('esconde o cadastro do certame de um gestor', () => {
    papeis.set(['gestor']);
    const rotulos = rotulosDeNavegacao().join(' | ');

    expect(rotulos).not.toContain('Processo seletivo');
    expect(rotulos).toContain('Inscrições');
  });

  /** Quem entra só como plataforma-admin não deve ver as telas operacionais. */
  it('esconde as telas operacionais de quem só administra a plataforma', () => {
    papeis.set(['plataforma-admin']);
    const rotulos = rotulosDeNavegacao().join(' | ');

    expect(rotulos).not.toContain('Inscrições');
    expect(rotulos).not.toContain('Homologação');
  });

  it('mantém o painel disponível para qualquer papel do backoffice', () => {
    papeis.set(['avaliador']);
    const rotulos = rotulosDeNavegacao().join(' | ');

    expect(rotulos).toContain('Painel de processos');
    expect(rotulos).toContain('Homologação');
  });

  describe('com o acompanhamento de validação habilitado', () => {
    beforeEach(() => configuracao.set({ acompanhamentoValidacaoHabilitada: true }));

    const menuPrincipal = 'nav[aria-label="Navegação principal"] a';

    function titulosDeGrupo(): string[] {
      const fixture = TestBed.createComponent(LayoutComponent);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      return Array.from(host.querySelectorAll('nav .sidebar__label'))
        .map((el) => el.textContent?.trim() ?? '')
        .filter((texto) => texto.length > 0);
    }

    it('organiza Acompanhamento e Cadastro para quem administra a plataforma', () => {
      papeis.set(['plataforma-admin']);

      expect(rotulosDeNavegacao(menuPrincipal)).toEqual([
        'Painel de processos',
        'Processos seletivos',
      ]);
      expect(titulosDeGrupo()).toEqual(['Acompanhamento', 'Cadastro']);
    });

    it('oferece só o painel a quem não tem papel de cadastro', () => {
      papeis.set([]);

      expect(rotulosDeNavegacao(menuPrincipal)).toEqual(['Painel de processos']);
    });

    it('tira Inscrições e Homologação do menu e não cria entrada de Notas nem Classificação', () => {
      papeis.set(['admin', 'gestor', 'avaliador']);
      const rotulos = rotulosDeNavegacao().join(' | ');

      expect(rotulos).not.toMatch(/Inscrições|Homologação|Notas|Classificação/);
    });
  });
});
