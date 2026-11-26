import { resolve } from 'node:path';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import {
  AuthService,
  PerfisDeAcessoService,
  UserContextService,
} from '@uniplus/shared-auth/bootstrap';
import { BackToTopComponent } from '@uniplus/shared-ui/components';
import { PortalShellComponent } from './portal-shell';
import { declaracoesDaRegra, lerFolhaDeEstilo } from '@uniplus/shared-testing';

const isAuthenticated = signal(false);
const authServiceStub = { logout: () => undefined, login: () => undefined };
const perfisStub = { estado: signal('carregada'), rotulos: signal([]), perfis: signal([]) };
const userContextStub = {
  user: signal(null),
  displayName: signal(''),
  firstDisplayName: signal(''),
  isAuthenticated,
};

async function montar(): Promise<ComponentFixture<PortalShellComponent>> {
  await TestBed.configureTestingModule({
    imports: [PortalShellComponent],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: authServiceStub },
      { provide: UserContextService, useValue: userContextStub },
      { provide: PerfisDeAcessoService, useValue: perfisStub },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(PortalShellComponent);
  fixture.detectChanges();
  return fixture;
}

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
        { provide: PerfisDeAcessoService, useValue: perfisStub },
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

  it('mantém no rodapé, ainda indisponíveis, as entradas de acessibilidade e privacidade', () => {
    const fixture = TestBed.createComponent(PortalShellComponent);
    fixture.detectChanges();
    const rodape = (fixture.nativeElement as HTMLElement).querySelector('footer');

    expect(rodape?.textContent).toContain('Política de privacidade');
    expect(rodape?.textContent).toContain('Acessibilidade');
  });

  it('não apresenta Ajuda na navegação principal', () => {
    expect(rotulosDeNavegacao()).not.toContain('Ajuda');
  });

  it.each([
    ['Centro de Processos Seletivos', 'https://ceps.unifesspa.edu.br'],
    ['Centro de Gestão Acadêmica', 'https://cga.unifesspa.edu.br'],
    [
      'Calendário acadêmico',
      'https://cga.unifesspa.edu.br/documentos/calend%C3%A1rio-acad%C3%AAmico.html',
    ],
  ])('abre %s em uma nova aba', (rotulo, endereco) => {
    const fixture = TestBed.createComponent(PortalShellComponent);
    fixture.detectChanges();
    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('footer a'));
    const link = links.find((elemento) => elemento.textContent?.trim() === rotulo);

    expect(link?.getAttribute('href')).toBe(endereco);
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.getAttribute('aria-label')).toBe(`${rotulo} (abre em nova aba)`);
  });
});

describe('PortalShellComponent — rolagem e impressão', () => {
  const folha = lerFolhaDeEstilo(resolve(__dirname, 'portal-shell.css'));
  const regra = (seletor: string, midia?: string) => declaracoesDaRegra(folha, seletor, midia);
  const janelaBaixa = '(max-height: 500px)';
  const indiceDaMidia = (condicao: string) =>
    folha.nodes.findIndex(
      (no) => no.type === 'atrule' && no.name === 'media' && no.params === condicao,
    );

  it('permite rolagem vertical e ancora o conteúdo', () => {
    expect(regra('.portal-scroll').get('overflow-y')).toBe('auto');
    expect(regra('.portal-scroll').get('position')).toBe('relative');
    const base = folha.nodes.findIndex(
      (no) => no.type === 'rule' && no.selectors.includes('.portal-scroll'),
    );
    expect(base).toBeGreaterThanOrEqual(0);
    expect(indiceDaMidia(janelaBaixa)).toBeGreaterThan(base);
  });

  it('em janela baixa libera a rolagem vertical sem corte horizontal', () => {
    expect(regra('.portal-scroll', janelaBaixa).get('flex')).toBe('1 0 auto');
    for (const seletor of [':host', '.portal-scroll']) {
      expect(regra(seletor, janelaBaixa).get('overflow-y')).toBe('visible');
      expect(['clip', 'hidden']).toContain(regra(seletor, janelaBaixa).get('overflow-x'));
    }
  });

  it('na impressão libera a altura e desfaz as restrições da janela baixa', () => {
    expect(indiceDaMidia('print')).toBeGreaterThan(indiceDaMidia(janelaBaixa));
    for (const seletor of [':host', '.portal-scroll']) {
      expect(regra(seletor, 'print').get('height')).toBe('auto');
      expect(regra(seletor, 'print').get('overflow')).toBe('visible');
    }
    expect(regra(':host', 'print').get('min-height')).toBe('auto');
    expect(regra('.portal-scroll', 'print').get('flex')).toBe('none');
    expect(regra('.portal-main', 'print').get('padding')).toBe('0');
  });

  it('cabeçalho, navegação, rodapé e controles flutuantes não vão para o papel', async () => {
    await TestBed.configureTestingModule({
      imports: [PortalShellComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceStub },
        { provide: UserContextService, useValue: userContextStub },
        { provide: PerfisDeAcessoService, useValue: perfisStub },
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

  it('mostra a marca institucional da Unifesspa no cabeçalho, no lugar do monograma', async () => {
    const fixture = await montar();
    const cabecalho = (fixture.nativeElement as HTMLElement).querySelector('header.portal-topbar');
    expect(cabecalho?.querySelector('ui-marca-institucional.topbar__marca')).not.toBeNull();
    expect(cabecalho?.textContent).not.toContain('U+');
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
