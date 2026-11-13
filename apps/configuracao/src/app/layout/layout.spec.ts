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

const concedidas = signal<readonly string[]>([]);
const permissoesStub = {
  temAlguma: (...codigos: string[]) => codigos.some((codigo) => concedidas().includes(codigo)),
};
const estadoDosPerfis = signal<EstadoDosPerfis>('carregada');
const rotulosDosPerfis = signal<readonly string[]>([]);
const perfisStub = { estado: estadoDosPerfis, rotulos: rotulosDosPerfis, perfis: signal([]) };
const userContextStub = {
  user: signal({
    id: 'u-1',
    username: 'leandro',
    nome: 'Leandro',
    email: 'leandro@exemplo.test',
  }),
  displayName: signal('Leandro'),
  firstDisplayName: signal('Leandro'),
};

const PERMISSOES_DA_ADMINISTRACAO = [
  'autorizacao:pedidos:aprovar-funcional',
  'autorizacao:pedidos:aprovar-protecao-de-dados',
  'autorizacao:concessoes:administrar',
  'autorizacao:perfis:manter',
];
const MENU_DA_ADMINISTRACAO = [
  'Meus pedidos',
  'Fila da gestão de acessos',
  'Fila do Representante do controlador',
  'Histórico de pedidos',
  'Concessões',
  'Perfis de acesso',
  'Divergências da governança',
];

describe('LayoutComponent — menu pelas permissões efetivas', () => {
  beforeEach(async () => {
    concedidas.set([]);
    estadoDosPerfis.set('carregada');
    rotulosDosPerfis.set([]);
    await TestBed.configureTestingModule({
      imports: [LayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { logout: () => undefined } },
        { provide: PerfisDeAcessoService, useValue: perfisStub },
        { provide: UserContextService, useValue: userContextStub },
        { provide: PermissoesService, useValue: permissoesStub },
      ],
    }).compileComponents();
  });

  function itensDoMenu(): string[] {
    const fixture = TestBed.createComponent(LayoutComponent);
    fixture.detectChanges();
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        'nav[aria-label="Navegação principal"] a',
      ),
    )
      .map((a) => a.textContent?.trim() ?? '')
      .filter((texto) => texto.length > 0);
  }

  it('mostra só as telas cujas permissões a pessoa tem', () => {
    concedidas.set(['configuracao:campi:manter', 'organizacao:unidades:manter']);

    expect(itensDoMenu()).toEqual(['Campus', 'Unidade', 'Meus pedidos']);
  });

  it('mostra Tipo de Ato a quem tem a permissão de Publicações', () => {
    concedidas.set(['publicacoes:tipos-ato:manter']);

    expect(itensDoMenu()).toEqual(['Tipo de Ato', 'Meus pedidos']);
  });

  it('sem permissão alguma, deixa só o pedido de acesso, que é de toda pessoa autenticada', () => {
    const fixture = TestBed.createComponent(LayoutComponent);
    fixture.detectChanges();

    expect(itensDoMenu()).toEqual(['Meus pedidos']);
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('nav .sidebar__label'),
    ).toHaveLength(1);
  });

  it('mostra a administração de acesso conforme a permissão de cada tela', () => {
    concedidas.set(PERMISSOES_DA_ADMINISTRACAO);

    expect(itensDoMenu()).toEqual(MENU_DA_ADMINISTRACAO);
  });

  it('não oferece a fila do Representante do controlador a quem só aprova como gestor', () => {
    concedidas.set(['autorizacao:pedidos:aprovar-funcional']);

    expect(itensDoMenu()).toEqual([
      'Meus pedidos',
      'Fila da gestão de acessos',
      'Histórico de pedidos',
    ]);
  });

  it('oferece as versões e as janelas da etapa a quem só tem a permissão de aprovar, com a lista de perfis', () => {
    concedidas.set(['autorizacao:perfis:aprovar-funcional']);

    expect(itensDoMenu()).toEqual([
      'Meus pedidos',
      'Perfis de acesso',
      'Versões na gestão de acessos',
      'Janelas na gestão de acessos',
      'Reclassificações na gestão de acessos',
    ]);
  });

  it('não oferece as janelas da proteção de dados a quem só aprova pela gestão de acessos', () => {
    concedidas.set(['autorizacao:perfis:aprovar-funcional']);

    expect(itensDoMenu()).not.toContain('Janelas na proteção de dados');
  });

  it('oferece a reclassificação da etapa e as divergências a quem tem a permissão de cada tela', () => {
    concedidas.set(['autorizacao:perfis:aprovar-protecao-de-dados']);

    expect(itensDoMenu()).toEqual([
      'Meus pedidos',
      'Perfis de acesso',
      'Versões na proteção de dados',
      'Janelas na proteção de dados',
      'Reclassificações na proteção de dados',
      'Divergências da governança',
    ]);
  });

  it('oferece a reclassificação da gestão de acessos sem as divergências a quem só aprova por ela', () => {
    concedidas.set(['autorizacao:perfis:aprovar-funcional']);

    const itens = itensDoMenu();
    expect(itens).toContain('Reclassificações na gestão de acessos');
    expect(itens).not.toContain('Divergências da governança');
    expect(itens).not.toContain('Reclassificações na proteção de dados');
  });

  it('oferece as divergências, mas não a reclassificação, a quem só mantém perfis', () => {
    concedidas.set(['autorizacao:perfis:manter']);

    const itens = itensDoMenu();
    expect(itens).toContain('Divergências da governança');
    expect(itens).not.toContain('Reclassificações na gestão de acessos');
  });

  it.each([
    'autorizacao:revisoes:conduzir',
    'autorizacao:revisoes:rever-protecao-de-dados',
    'autorizacao:revisoes:consultar',
  ])('oferece as revisões de acesso a quem tem %s', (permissao) => {
    concedidas.set([permissao]);

    expect(itensDoMenu()).toEqual(['Meus pedidos', 'Revisões de acesso']);
  });

  it('não oferece as revisões de acesso a quem não as conduz, revê nem consulta', () => {
    concedidas.set(PERMISSOES_DA_ADMINISTRACAO);

    expect(itensDoMenu()).not.toContain('Revisões de acesso');
  });

  it('oferece a publicação do termo só a quem tem a permissão de publicar', () => {
    concedidas.set(['autorizacao:termos:publicar']);
    expect(itensDoMenu()).toEqual(['Meus pedidos', 'Termo de responsabilidade']);

    concedidas.set(PERMISSOES_DA_ADMINISTRACAO);
    expect(itensDoMenu()).not.toContain('Termo de responsabilidade');
  });

  it('aponta o Início do breadcrumb para a entrada, que escolhe uma tela permitida', () => {
    concedidas.set(['configuracao:tipos-processo:consultar']);
    const fixture = TestBed.createComponent(LayoutComponent);
    fixture.detectChanges();

    const inicio = (fixture.nativeElement as HTMLElement).querySelector(
      'nav[aria-label="Breadcrumb"] a, nav[aria-label*="readcrumb" i] a',
    );

    expect(inicio?.getAttribute('href')).toBe('/');
  });

  it('usa o componente compartilhado do perfil na barra lateral, com o username', () => {
    const fixture = TestBed.createComponent(LayoutComponent);
    fixture.detectChanges();

    const barra = (fixture.nativeElement as HTMLElement).querySelector('.sidebar__user-info');
    expect(barra?.querySelector('auth-perfis-da-barra')?.textContent?.trim()).toBe('@leandro');
  });
});
