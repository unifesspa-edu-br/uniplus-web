import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  AuthService,
  PerfisDeAcessoService,
  PermissoesService,
  UserContextService,
  type EstadoDosPerfis,
} from '@uniplus/shared-auth/bootstrap';
import { LayoutComponent } from './layout';

const estadoDosPerfis = signal<EstadoDosPerfis>('carregada');
const rotulosDosPerfis = signal<readonly string[]>([]);
const concedidas = signal<readonly string[]>([]);
const menuPrincipal = 'nav[aria-label="Navegação principal"] a';
const permissoesStub = {
  tem: (codigo: string) => concedidas().includes(codigo),
  temAlguma: (...codigos: string[]) => codigos.some((codigo) => concedidas().includes(codigo)),
};
const authServiceStub = { logout: () => undefined };
const perfisStub = { estado: estadoDosPerfis, rotulos: rotulosDosPerfis, perfis: signal([]) };
const userContextStub = {
  user: signal({
    id: 'u-1',
    username: 'leandro.viana',
    nome: 'Admin Teste',
    email: 'admin@teste.br',
  }),
  displayName: signal('Admin Teste'),
  firstDisplayName: signal('Admin'),
};

/** A navegação tem de espelhar as permissões das rotas: item visível que o guard recusa é um clique sem saída. */
describe('LayoutComponent — navegação por permissão', () => {
  beforeEach(async () => {
    concedidas.set([]);
    estadoDosPerfis.set('carregada');
    rotulosDosPerfis.set([]);
    await TestBed.configureTestingModule({
      imports: [LayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceStub },
        { provide: UserContextService, useValue: userContextStub },
        { provide: PermissoesService, useValue: permissoesStub },
        { provide: PerfisDeAcessoService, useValue: perfisStub },
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

  function titulosDeGrupo(): string[] {
    const fixture = TestBed.createComponent(LayoutComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    return Array.from(host.querySelectorAll('nav .sidebar__label'))
      .map((el) => el.textContent?.trim() ?? '')
      .filter((texto) => texto.length > 0);
  }

  it('oferece o painel a toda pessoa autenticada, sem permissão e sem grupo vazio', () => {
    expect(rotulosDeNavegacao()).toEqual(['Painel de processos']);
    expect(titulosDeGrupo()).toEqual(['Acompanhamento']);
  });

  it('organiza Acompanhamento e Cadastro para quem pode configurar processo', () => {
    concedidas.set(['selecao:processos:configurar']);

    expect(rotulosDeNavegacao()).toEqual(['Painel de processos', 'Processos seletivos']);
    expect(titulosDeGrupo()).toEqual(['Acompanhamento', 'Cadastro']);
  });

  it('não dá o cadastro a quem só acompanha processos', () => {
    concedidas.set(['selecao:processos:acompanhar']);

    expect(rotulosDeNavegacao()).toEqual(['Painel de processos']);
  });

  it('tira o cadastro do menu quando as permissões somem (troca de sessão ou falha da consulta)', () => {
    concedidas.set(['selecao:processos:configurar']);
    const fixture = TestBed.createComponent(LayoutComponent);
    fixture.detectChanges();
    const links = () =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll(menuPrincipal)).map((a) =>
        a.textContent?.trim(),
      );
    expect(links()).toEqual(['Painel de processos', 'Processos seletivos']);

    concedidas.set([]);
    fixture.detectChanges();

    expect(links()).toEqual(['Painel de processos']);
  });

  it('não cria entrada de Homologação, Notas nem Classificação', () => {
    concedidas.set([
      'selecao:processos:acompanhar',
      'selecao:inscricoes:consultar',
      'selecao:notas-enem:importar',
    ]);

    expect(rotulosDeNavegacao().join(' | ')).not.toMatch(/Homologação|Notas|Classificação/);
  });
});

describe('LayoutComponent — perfil na barra lateral', () => {
  it('usa o componente compartilhado, com o username para o @usuário', async () => {
    await TestBed.configureTestingModule({
      imports: [LayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceStub },
        { provide: UserContextService, useValue: userContextStub },
        { provide: PermissoesService, useValue: permissoesStub },
        { provide: PerfisDeAcessoService, useValue: perfisStub },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(LayoutComponent);
    fixture.detectChanges();

    const barra = (fixture.nativeElement as HTMLElement).querySelector('.sidebar__user-info');
    expect(barra?.querySelector('auth-perfis-da-barra')?.textContent?.trim()).toBe(
      '@leandro.viana',
    );
  });
});
