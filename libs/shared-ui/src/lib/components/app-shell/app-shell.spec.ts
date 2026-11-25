import { resolve } from 'node:path';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppShellComponent, UiShellNavGroup } from './app-shell';
import { declaracoesDaRegra, lerFolhaDeEstilo } from '@uniplus/shared-testing';
import postcss, { type Rule } from 'postcss';

function pertenceARegiaoRolavel(seletor: string): boolean {
  return ['.page', '.sidebar nav'].some(
    (prefixo) =>
      seletor === prefixo ||
      (seletor.startsWith(prefixo) && /^[^-\w]/u.test(seletor.slice(prefixo.length))),
  );
}

function pertenceAMidia(regra: Rule, midia?: string): boolean {
  const pai = regra.parent;
  if (midia === undefined) return pai?.type === 'root';
  return (
    pai?.type === 'atrule' &&
    pai.name === 'media' &&
    pai.params === midia &&
    pai.parent?.type === 'root'
  );
}

const groups: readonly UiShellNavGroup[] = [
  {
    label: 'Painéis',
    items: [
      { label: 'Painel', icon: 'pi-table', routerLink: '/dashboard' },
      { label: 'Bloqueado', routerLink: '/bloqueado', disabled: true },
    ],
  },
];

@Component({
  standalone: true,
  imports: [AppShellComponent],
  template:
    '<ui-app-shell appName="Uni+"><div uiShellActions>acao</div><div uiShellUser>usuario</div></ui-app-shell>',
})
class HostComponent {}

async function montarShell() {
  await TestBed.configureTestingModule({
    imports: [AppShellComponent],
    providers: [provideRouter([])],
  }).compileComponents();
  const fixture = TestBed.createComponent(AppShellComponent);
  fixture.componentRef.setInput('appName', 'Uni+');
  fixture.detectChanges();
  return { fixture, host: fixture.nativeElement as HTMLElement };
}

async function montarHost() {
  await TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: [provideRouter([])],
  }).compileComponents();
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return { fixture, host: fixture.nativeElement as HTMLElement };
}

describe('AppShellComponent', () => {
  it('renderiza grupos de navegação recebidos pelo app', async () => {
    const { fixture, host } = await montarShell();
    fixture.componentRef.setInput('navGroups', groups);
    fixture.detectChanges();
    expect(host.querySelector('.sidebar__label')?.textContent).toContain('Painéis');
    expect(host.querySelectorAll('.sidebar a').length).toBe(1);
  });

  it('marca item desabilitado sem vínculo', async () => {
    const { fixture, host } = await montarShell();
    fixture.componentRef.setInput('navGroups', groups);
    fixture.detectChanges();
    expect(host.querySelector('.sidebar__link.is-disabled')?.getAttribute('aria-disabled')).toBe(
      'true',
    );
  });

  it('renderiza projeções [uiShellActions] e [uiShellUser]', async () => {
    const { host } = await montarHost();
    expect(host.querySelector('[uiShellActions]')?.textContent).toBe('acao');
    expect(host.querySelector('[uiShellUser]')?.textContent).toBe('usuario');
  });

  it('renderiza breadcrumb resolvido e marca o último como atual', async () => {
    const { fixture, host } = await montarShell();
    fixture.componentRef.setInput('breadcrumb', [
      { label: 'Inicio', routerLink: '/dashboard' },
      { label: 'Atual' },
    ]);
    fixture.detectChanges();
    const itens = host.querySelectorAll('.breadcrumb__item');
    expect(itens.length).toBe(2);
    expect(itens[1].querySelector('.breadcrumb__current')?.getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('tira do papel tudo o que só serve à tela e deixa o conteúdo', async () => {
    const { host } = await montarShell();

    for (const seletor of [
      'ui-skip-link',
      'ui-institutional-bar',
      'aside.sidebar',
      'header.admin-topbar',
      'ui-a11y-menu',
      'ui-back-to-top',
      'ui-vlibras-loader',
    ]) {
      expect(host.querySelector(seletor)?.classList.contains('u-no-print'), seletor).toBe(true);
    }
    expect(host.querySelector('main.page')?.closest('.u-no-print')).toBeNull();
  });

  it('mostra a marca institucional da Unifesspa na lateral, no lugar do monograma', async () => {
    const { host } = await montarShell();
    const marca = host.querySelector('.sidebar__brand ui-marca-institucional');
    expect(marca).not.toBeNull();
    expect(host.querySelector('.sidebar__brand')?.textContent).not.toContain('U+');
  });

  it('arma o skip link com o id do main', async () => {
    const { host } = await montarShell();
    expect(host.querySelector('main.page')?.id).toBeTruthy();
    expect(host.querySelector('ui-skip-link')).toBeTruthy();
  });

  it('monta o botão global "Voltar ao topo" ancorado em main.page', async () => {
    const { host } = await montarShell();
    const botao = host.querySelector('ui-back-to-top .uni-back-to-top');
    expect(botao).toBeTruthy();
    expect(botao?.getAttribute('aria-label')).toBe('Voltar ao topo do conteúdo');
  });

  it('abre um único drawer mobile, sem duplicar a sidebar fixa como segundo painel', async () => {
    const { fixture, host } = await montarShell();
    fixture.componentRef.setInput('navGroups', groups);
    fixture.detectChanges();

    const botaoAbrirMenu = host.querySelector(
      '.sidebar-toggle--compacto',
    ) as HTMLButtonElement | null;
    botaoAbrirMenu?.click();
    fixture.detectChanges();

    expect(host.querySelector('.admin-shell')?.hasAttribute('data-sidebar-mobile')).toBe(false);
    const dialog = host.querySelector('dialog.uni-drawer') as HTMLDialogElement | null;
    expect(dialog?.id).toBeTruthy();
    expect(dialog?.id).toBe(botaoAbrirMenu?.getAttribute('aria-controls'));
  });

  it('não duplica a navegação da sidebar numa topbar redundante', async () => {
    const { fixture, host } = await montarShell();
    fixture.componentRef.setInput('navGroups', groups);
    fixture.detectChanges();
    expect(host.querySelector('.topbar__nav')).toBeNull();
  });

  describe('contrato de rolagem da folha de estilo compartilhada', () => {
    const folha = lerFolhaDeEstilo(resolve(__dirname, '../../../styles/components.css'));
    const regra = (seletor: string, midia?: string) => declaracoesDaRegra(folha, seletor, midia);

    function verificarDeclaracoesNaMesmaRegra(
      seletor: string,
      marcador: readonly [string, string],
      esperadas: Readonly<Record<string, string | RegExp>>,
      midia?: string,
    ) {
      let encontrada = false;
      folha.walkRules((no) => {
        if (!no.selectors.includes(seletor) || !pertenceAMidia(no, midia)) return;
        const declaracoes = declaracoesDaRegra(postcss.root({ nodes: [no.clone()] }), seletor);
        if (declaracoes.get(marcador[0]) !== marcador[1]) return;
        for (const [propriedade, esperado] of Object.entries(esperadas)) {
          if (typeof esperado === 'string') expect(declaracoes.get(propriedade)).toBe(esperado);
          else expect(declaracoes.get(propriedade)).toMatch(esperado);
        }
        encontrada = true;
      });
      expect(encontrada, seletor).toBe(true);
    }

    it('limita a altura da página e permite rolagem vertical do conteúdo', () => {
      expect(regra('ui-app-shell').get('height')).toBe('100dvh');
      expect(regra('ui-app-shell').get('overflow')).toBe('hidden');
      expect(regra('.page').get('overflow-y')).toBe('auto');
      expect(regra('.page').get('overflow-x')).toBe('hidden');
      expect(regra('.page').get('overscroll-behavior')).toBe('contain');
      expect(regra('.page').get('position')).toBe('relative');
    });

    it('contém os campos de marcação e oferece rolagem lateral própria', () => {
      for (const seletor of ['.checkbox', '.radio', '.switch'])
        expect(regra(seletor).get('position')).toBe('relative');
      expect(regra('.sidebar nav').get('overflow-y')).toBe('auto');
      expect(regra('.sidebar nav').get('overscroll-behavior')).toBe('contain');
      expect(regra('.sidebar', '(min-width: 1024px)').get('max-height')).toBe('100dvh');
      expect(regra('.sidebar', '(min-width: 1024px)').get('min-height')).toBe('0');
      expect(regra('.sidebar', '(min-width: 1024px)').get('align-self')).toBe('stretch');
      expect(regra('.uni-drawer').get('max-height')).toBe('100dvh');
      expect(regra('.uni-drawer__panel').get('height')).toBe('100dvh');
    });

    it('mantém posição e altura da barra lateral na mesma regra para telas largas', () => {
      verificarDeclaracoesNaMesmaRegra(
        '.sidebar',
        ['position', 'sticky'],
        { 'max-height': '100dvh', 'align-self': 'stretch', 'min-height': '0' },
        '(min-width: 1024px)',
      );
    });

    it('limita largura e altura da gaveta na mesma regra', () => {
      verificarDeclaracoesNaMesmaRegra('.uni-drawer', ['max-width', '100vw'], {
        'max-height': '100dvh',
      });
    });

    it('limita largura e define altura do painel da gaveta na mesma regra', () => {
      verificarDeclaracoesNaMesmaRegra('.uni-drawer__panel', ['max-width', '320px'], {
        height: '100dvh',
      });
    });

    it('associa a altura do shell à regra que oculta sua rolagem', () => {
      verificarDeclaracoesNaMesmaRegra('ui-app-shell', ['overflow', 'hidden'], {
        height: /^100dvh$/u,
      });
    });

    it('associa posição e cor do trilho à regra de rolagem da página', () => {
      verificarDeclaracoesNaMesmaRegra('.page', ['overflow-y', 'auto'], {
        position: /^relative$/u,
        'scrollbar-color': /^var\(--/u,
      });
    });

    it('associa a cor do trilho à regra de rolagem da navegação lateral', () => {
      verificarDeclaracoesNaMesmaRegra('.sidebar nav', ['overflow-y', 'auto'], {
        'scrollbar-color': /^color-mix\(/u,
      });
    });

    it('pinta o trilho das duas regiões roláveis', () => {
      for (const seletor of ['.page', '.sidebar nav']) {
        const valor = regra(seletor).get('scrollbar-color');
        expect(valor).toBeDefined();
        expect(postcss.list.space(valor ?? '')[0]).not.toBe('transparent');
      }
    });

    it('usa tokens na cor base dos trilhos', () => {
      expect(regra('.page').get('scrollbar-color')).toMatch(/^var\(--/u);
      expect(regra('.sidebar nav').get('scrollbar-color')).toMatch(/^color-mix\(.*var\(--/u);
    });

    it('evita cores fixas nas regiões roláveis e em seus seletores derivados', () => {
      folha.walkRules((regraDaFolha) => {
        if (!regraDaFolha.selectors.some(pertenceARegiaoRolavel)) return;
        regraDaFolha.walkDecls((declaracao) => {
          expect(declaracao.value).not.toMatch(/#[0-9a-f]{3,8}\b|\brgba?\(/iu);
        });
      });
    });
  });

  it('expõe main.page e aside > nav como as duas regiões roláveis', async () => {
    const { fixture, host } = await montarShell();
    fixture.componentRef.setInput('navGroups', groups);
    fixture.detectChanges();
    expect(host.querySelector('main.page')).toBeTruthy();
    expect(host.querySelector('aside.sidebar > nav')).toBeTruthy();
  });
});
