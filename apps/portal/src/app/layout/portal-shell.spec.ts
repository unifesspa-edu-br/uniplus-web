import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AuthService, UserContextService } from '@uniplus/shared-auth/bootstrap';
import { BackToTopComponent } from '@uniplus/shared-ui/components';
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

  /** Corpo do `@media (max-height: 500px)`, sem as chaves externas. */
  function blocoDeJanelaBaixa(): string {
    const inicio = css.search(/@media\s*\(max-height:\s*500px\)\s*\{/u);
    if (inicio < 0) return '';
    const abertura = css.indexOf('{', inicio);
    let profundidade = 0;
    for (let i = abertura; i < css.length; i++) {
      if (css[i] === '{') profundidade++;
      else if (css[i] === '}' && --profundidade === 0) return css.slice(abertura + 1, i);
    }
    return '';
  }

  it('a regra de janela baixa vem depois da regra base, que senão a anularia na cascata', () => {
    const janelaBaixa = css.search(/@media\s*\(max-height:\s*500px\)\s*\{/u);

    expect(janelaBaixa).toBeGreaterThan(css.search(/\.portal-scroll\s*\{/u));
  });

  it('em janela baixa, o conteúdo preenche o min-height do host sem encolher', () => {
    const regra = blocoDeJanelaBaixa()
      .split('}')
      .find((r) => r.split('{')[0].trim() === '.portal-scroll');

    expect(regra).toMatch(/flex:\s*1 0 auto/u);
  });

  it.each([':host', '.portal-scroll'])(
    'em janela baixa, %s libera só o eixo y e mantém o corte horizontal',
    (seletor) => {
      const regra = blocoDeJanelaBaixa()
        .split('}')
        .find((r) => r.split('{')[0].trim() === seletor);

      expect(regra, seletor).toBeDefined();
      expect(regra).toMatch(/overflow-y:\s*visible/u);
      expect(regra).toMatch(/overflow-x:\s*(clip|hidden)/u);
    },
  );
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

  it('no papel, vem depois da janela baixa e desfaz a altura mínima e o crescimento do conteúdo', () => {
    const janelaBaixa = css.search(/@media\s*\(max-height:\s*500px\)\s*\{/u);

    expect(css.search(/@media\s+print\s*\{/u)).toBeGreaterThan(janelaBaixa);
    expect(declaracoesNaImpressao(':host')).toMatch(/min-height:\s*auto/u);
    expect(declaracoesNaImpressao('.portal-scroll')).toMatch(/flex:\s*none/u);
  });

  it('no papel, o conteúdo não leva o respiro de tela, que empurraria uma última página em branco', () => {
    expect(declaracoesNaImpressao('.portal-main')).toMatch(/padding:\s*0\s*(;|$)/u);
  });

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

/**
 * Em janela baixa (`max-height: 500px`) a página rola inteira — o
 * `ui-back-to-top` tem de observar o `<html>`, não o `.portal-scroll`.
 */
describe('PortalShellComponent — contêiner de rolagem do "Voltar ao topo"', () => {
  const matchMediaOriginal = window.matchMedia;
  let ouvintes: ((e: MediaQueryListEvent) => void)[] = [];
  let removidos: ((e: MediaQueryListEvent) => void)[] = [];

  function stubMatchMedia(matches: boolean): void {
    ouvintes = [];
    removidos = [];
    window.matchMedia = ((consulta: string) => ({
      matches,
      media: consulta,
      addEventListener: (_: string, ouvinte: (e: MediaQueryListEvent) => void) =>
        ouvintes.push(ouvinte),
      removeEventListener: (_: string, ouvinte: (e: MediaQueryListEvent) => void) =>
        removidos.push(ouvinte),
    })) as unknown as typeof window.matchMedia;
  }

  async function montar(): Promise<ComponentFixture<PortalShellComponent>> {
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
    return fixture;
  }

  function containerObservado(fixture: ComponentFixture<PortalShellComponent>): HTMLElement {
    const voltarAoTopo = fixture.debugElement.query(By.directive(BackToTopComponent));
    return (voltarAoTopo.componentInstance as BackToTopComponent).defaultContainer() as HTMLElement;
  }

  afterEach(() => {
    document.documentElement.scrollTop = 0;
    window.matchMedia = matchMediaOriginal;
  });

  it('observa o <html> em janela baixa', async () => {
    stubMatchMedia(true);

    expect(containerObservado(await montar())).toBe(document.documentElement);
  });

  it('observa o .portal-scroll em janela alta', async () => {
    stubMatchMedia(false);

    const container = containerObservado(await montar());

    expect(container.classList.contains('portal-scroll')).toBe(true);
  });

  it('troca o contêiner observado quando a altura da janela cruza o limiar', async () => {
    stubMatchMedia(false);
    const fixture = await montar();

    ouvintes.forEach((o) => o({ matches: true } as MediaQueryListEvent));
    fixture.detectChanges();
    expect(containerObservado(fixture)).toBe(document.documentElement);

    ouvintes.forEach((o) => o({ matches: false } as MediaQueryListEvent));
    fixture.detectChanges();
    expect(containerObservado(fixture).classList.contains('portal-scroll')).toBe(true);
  });

  it('remove o ouvinte da media query ao destruir o shell', async () => {
    stubMatchMedia(false);
    const fixture = await montar();

    fixture.destroy();

    expect(ouvintes).toHaveLength(1);
    expect(removidos).toEqual(ouvintes);
  });
});
