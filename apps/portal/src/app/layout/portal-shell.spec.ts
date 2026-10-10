import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
    return Array.from(host.querySelectorAll('nav.portal-nav a, nav.portal-nav span'))
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

describe('PortalShellComponent — contrato de rolagem', () => {
  const css = readFileSync(resolve(__dirname, 'portal-shell.css'), 'utf-8').replace(
    /\/\*[\s\S]*?\*\//gu,
    '',
  );
  const area = css.match(/\.portal-scroll\s*\{[^{}]*\}/u)?.[0] ?? '';

  it('a area de conteudo rola por dentro e ancora o conteudo posicionado, que senao esticaria a pagina', () => {
    expect(area).toContain('overflow-y: auto');
    expect(area).toContain('position: relative');
  });
});

describe('PortalShellComponent — contrato de impressão', () => {
  const css = readFileSync(resolve(__dirname, 'portal-shell.css'), 'utf-8').replace(
    /\/\*[\s\S]*?\*\//gu,
    '',
  );

  /** Corpo do `@media print`, com os blocos aninhados. */
  function blocoDeImpressao(): string {
    const inicio = css.search(/@media\s+print\s*\{/u);
    if (inicio < 0) return '';
    const abertura = css.indexOf('{', inicio);
    let profundidade = 0;
    for (let i = abertura; i < css.length; i++) {
      if (css[i] === '{') profundidade++;
      else if (css[i] === '}' && --profundidade === 0) return css.slice(abertura + 1, i);
    }
    return '';
  }

  /** Declarações das regras do bloco de impressão que alcançam `seletor`. */
  function declaracoesNaImpressao(seletor: string): string {
    return Array.from(blocoDeImpressao().matchAll(/([^{}]+)\{([^{}]*)\}/gu))
      .filter(([, seletores]) => seletores.split(',').some((s) => s.trim() === seletor))
      .map(([, , declaracoes]) => declaracoes)
      .join(';');
  }

  it.each([':host', '.portal-scroll'])(
    'no papel, %s solta a altura do viewport e não corta o conteúdo',
    (seletor) => {
      const declaracoes = declaracoesNaImpressao(seletor);

      expect(declaracoes).toContain('height: auto');
      expect(declaracoes).toContain('overflow: visible');
    },
  );

  it('cabeçalho, navegação, rodapé e controles flutuantes não vão para o papel', async () => {
    await TestBed.configureTestingModule({
      imports: [PortalShellComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceStub },
        { provide: UserContextService, useValue: userContextStub },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PortalShellComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    for (const seletor of [
      'ui-skip-link',
      'ui-institutional-bar',
      'header.portal-topbar',
      'nav.portal-nav',
      'footer.portal-footer',
      'ui-back-to-top',
      'ui-vlibras-loader',
    ]) {
      expect(host.querySelector(seletor)?.classList.contains('u-no-print'), seletor).toBe(true);
    }
    expect(host.querySelector('main')?.closest('.u-no-print')).toBeNull();
  });
});
