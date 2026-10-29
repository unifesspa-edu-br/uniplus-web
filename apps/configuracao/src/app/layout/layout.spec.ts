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

    expect(itensDoMenu()).toEqual(['Campus', 'Unidade']);
  });

  it('mostra Tipo de Ato a quem tem a permissão de Publicações', () => {
    concedidas.set(['publicacoes:tipos-ato:manter']);

    expect(itensDoMenu()).toEqual(['Tipo de Ato']);
  });

  it('não mostra nenhuma tela, nem grupo vazio, quando a lista de permissões é vazia', () => {
    const fixture = TestBed.createComponent(LayoutComponent);
    fixture.detectChanges();

    expect(itensDoMenu()).toEqual([]);
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('nav .sidebar__label'),
    ).toHaveLength(0);
  });
});
