import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService, PermissoesService, UserContextService } from '@uniplus/shared-auth/bootstrap';
import { AppConfigService } from '@uniplus/shared-data/config';
import { LayoutComponent } from './layout';

const papeis = signal<readonly string[]>([]);
const concedidas = signal<readonly string[]>([]);
const menuPrincipal = 'nav[aria-label="Navegação principal"] a';
const permissoesStub = {
  tem: (codigo: string) => concedidas().includes(codigo),
  temAlguma: (...codigos: string[]) => codigos.some((codigo) => concedidas().includes(codigo)),
};
const configuracao = signal<{ acompanhamentoValidacaoHabilitada?: boolean } | null>(null);
const authServiceStub = { roles: papeis, logout: () => undefined };
const userContextStub = {
  user: signal({ id: 'u-1', nome: 'Admin Teste', email: 'admin@teste.br', roles: [] }),
  displayName: signal('Admin Teste'),
  firstDisplayName: signal('Admin'),
};

/** A navegação tem de espelhar as permissões das rotas: item visível que o guard recusa é um clique sem saída. */
describe('LayoutComponent — navegação por permissão', () => {
  beforeEach(async () => {
    configuracao.set(null);
    concedidas.set([]);
    await TestBed.configureTestingModule({
      imports: [LayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceStub },
        { provide: UserContextService, useValue: userContextStub },
        { provide: PermissoesService, useValue: permissoesStub },
        { provide: AppConfigService, useValue: { config: configuracao } },
      ],
    }).compileComponents();
  });

  function rotulosDeNavegacao(seletor = menuPrincipal): string[] {
    const fixture = TestBed.createComponent(LayoutComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    return Array.from(host.querySelectorAll(seletor) as NodeListOf<HTMLAnchorElement>)
      .map((a) => a.textContent?.trim() ?? '')
      .filter((texto) => texto.length > 0);
  }

  it('oferece cada entrada só a quem tem a permissão da rota', () => {
    concedidas.set(['selecao:processos:configurar']);
    expect(rotulosDeNavegacao().join(' | ')).toBe('Processo seletivo');

    concedidas.set(['selecao:inscricoes:consultar']);
    expect(rotulosDeNavegacao().join(' | ')).toBe('Inscrições');

    concedidas.set(['selecao:processos:acompanhar']);
    expect(rotulosDeNavegacao().join(' | ')).toBe('Painel de processos | Homologação');
  });

  it('não oferece nada a quem não tem permissão da Seleção', () => {
    expect(rotulosDeNavegacao()).toEqual([]);
  });

  describe('com o acompanhamento de validação habilitado', () => {
    beforeEach(() => configuracao.set({ acompanhamentoValidacaoHabilitada: true }));

    function titulosDeGrupo(): string[] {
      const fixture = TestBed.createComponent(LayoutComponent);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      return Array.from(host.querySelectorAll('nav .sidebar__label'))
        .map((el) => el.textContent?.trim() ?? '')
        .filter((texto) => texto.length > 0);
    }

    it('organiza Acompanhamento e Cadastro para quem pode configurar processo', () => {
      concedidas.set(['selecao:processos:configurar', 'selecao:processos:acompanhar']);

      expect(rotulosDeNavegacao(menuPrincipal)).toEqual([
        'Painel de processos',
        'Processos seletivos',
      ]);
      expect(titulosDeGrupo()).toEqual(['Acompanhamento', 'Cadastro']);
    });

    it('oferece o painel a toda pessoa autenticada, sem permissão da Seleção', () => {
      expect(rotulosDeNavegacao(menuPrincipal)).toEqual(['Painel de processos']);
    });

    it('oferece só o painel a quem não tem a permissão de cadastro', () => {
      concedidas.set(['selecao:processos:acompanhar']);

      expect(rotulosDeNavegacao(menuPrincipal)).toEqual(['Painel de processos']);
    });

    it('tira Inscrições e Homologação do menu e não cria entrada de Notas nem Classificação', () => {
      concedidas.set([
        'selecao:processos:acompanhar',
        'selecao:inscricoes:consultar',
        'selecao:notas-enem:importar',
      ]);
      const rotulos = rotulosDeNavegacao().join(' | ');

      expect(rotulos).not.toMatch(/Inscrições|Homologação|Notas|Classificação/);
    });
  });
});
