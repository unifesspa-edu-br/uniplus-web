import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService, UserContextService } from '@uniplus/shared-auth/bootstrap';
import { LayoutComponent } from './layout';

const papeis = signal<readonly string[]>([]);
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
    await TestBed.configureTestingModule({
      imports: [LayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceStub },
        { provide: UserContextService, useValue: userContextStub },
      ],
    }).compileComponents();
  });

  function rotulosDeNavegacao(): string[] {
    const fixture = TestBed.createComponent(LayoutComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    return [...host.querySelectorAll('nav a')]
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
});
