import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService, PermissoesService, UserContextService } from '@uniplus/shared-auth/bootstrap';
import { LayoutComponent } from './layout';

const concedidas = signal<readonly string[]>([]);
const permissoesStub = {
  temAlguma: (...codigos: string[]) => codigos.some((codigo) => concedidas().includes(codigo)),
};
const userContextStub = {
  user: signal({
    id: 'u-1',
    username: 'leandro',
    nome: 'Leandro',
    email: 'leandro@exemplo.test',
    roles: [],
  }),
  displayName: signal('Leandro'),
  firstDisplayName: signal('Leandro'),
};

describe('LayoutComponent — menu pelas permissões efetivas', () => {
  beforeEach(async () => {
    concedidas.set([]);
    await TestBed.configureTestingModule({
      imports: [LayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { roles: signal([]), logout: () => undefined } },
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
    concedidas.set([
      'autorizacao:pedidos:aprovar-funcional',
      'autorizacao:pedidos:aprovar-protecao-de-dados',
      'autorizacao:concessoes:administrar',
      'autorizacao:perfis:manter',
    ]);

    expect(itensDoMenu()).toEqual([
      'Meus pedidos',
      'Fila do gestor',
      'Fila da proteção de dados',
      'Histórico de pedidos',
      'Concessões',
      'Perfis de acesso',
    ]);
  });

  it('não oferece a fila da proteção de dados a quem só aprova como gestor', () => {
    concedidas.set(['autorizacao:pedidos:aprovar-funcional']);

    expect(itensDoMenu()).toEqual(['Meus pedidos', 'Fila do gestor', 'Histórico de pedidos']);
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
});
