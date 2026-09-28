import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService, UserContextService } from '@uniplus/shared-auth/bootstrap';
import { PortalShellComponent } from './portal-shell';

const isAuthenticated = signal(false);
const authServiceStub = { logout: () => undefined, login: () => undefined };
const userContextStub = {
  user: signal(null),
  displayName: signal(''),
  firstDisplayName: signal(''),
  isAuthenticated,
};

/**
 * "Minhas inscrições" leva a uma rota autenticada (`authGuard` em
 * app.routes.ts) — o item de menu tem de espelhar isso, ou candidato
 * anônimo vê um link que só serve para jogá-lo em `/acesso-negado`.
 */
describe('PortalShellComponent — navegação por autenticação', () => {
  beforeEach(async () => {
    isAuthenticated.set(false);
    await TestBed.configureTestingModule({
      imports: [PortalShellComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceStub },
        { provide: UserContextService, useValue: userContextStub },
      ],
    }).compileComponents();
  });

  function rotulosDeNavegacao(): string[] {
    const fixture = TestBed.createComponent(PortalShellComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    return [...host.querySelectorAll('nav.portal-nav a, nav.portal-nav span')]
      .map((el) => el.textContent?.trim() ?? '')
      .filter((texto) => texto.length > 0);
  }

  it('esconde "Minhas inscrições" de quem não está autenticado', () => {
    isAuthenticated.set(false);
    const rotulos = rotulosDeNavegacao().join(' | ');

    expect(rotulos).not.toContain('Minhas inscrições');
    expect(rotulos).toContain('Editais');
  });

  it('exibe "Minhas inscrições" para quem está autenticado', () => {
    isAuthenticated.set(true);
    const rotulos = rotulosDeNavegacao().join(' | ');

    expect(rotulos).toContain('Minhas inscrições');
  });

  it('esconde "Minhas inscrições" também no rodapé de quem não está autenticado', () => {
    isAuthenticated.set(false);
    const fixture = TestBed.createComponent(PortalShellComponent);
    fixture.detectChanges();
    const footer = (fixture.nativeElement as HTMLElement).querySelector('.portal-footer');

    expect(footer?.textContent).not.toContain('Minhas inscrições');
  });

  it('exibe "Minhas inscrições" no rodapé para quem está autenticado', () => {
    isAuthenticated.set(true);
    const fixture = TestBed.createComponent(PortalShellComponent);
    fixture.detectChanges();
    const footer = (fixture.nativeElement as HTMLElement).querySelector('.portal-footer');

    expect(footer?.textContent).toContain('Minhas inscrições');
  });
});
