import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppShellComponent, UiShellNavGroup } from './app-shell';

const groups: readonly UiShellNavGroup[] = [
  {
    label: 'Paineis',
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
  it('renderiza grupos de navegacao recebidos pelo app', async () => {
    const { fixture, host } = await montarShell();
    fixture.componentRef.setInput('navGroups', groups);
    fixture.detectChanges();
    expect(host.querySelector('.sidebar__label')?.textContent).toContain('Paineis');
    expect(host.querySelectorAll('.sidebar a').length).toBe(1);
  });

  it('marca item desabilitado sem vinculo', async () => {
    const { fixture, host } = await montarShell();
    fixture.componentRef.setInput('navGroups', groups);
    fixture.detectChanges();
    expect(host.querySelector('.sidebar__link.is-disabled')?.getAttribute('aria-disabled')).toBe(
      'true',
    );
  });

  it('renderiza projecoes [uiShellActions] e [uiShellUser]', async () => {
    const { host } = await montarHost();
    expect(host.querySelector('[uiShellActions]')?.textContent).toBe('acao');
    expect(host.querySelector('[uiShellUser]')?.textContent).toBe('usuario');
  });

  it('renderiza breadcrumb resolvido e marca o ultimo como atual', async () => {
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

  it('arma o skip link com o id do main', async () => {
    const { host } = await montarShell();
    expect(host.querySelector('main.page')?.id).toBeTruthy();
    expect(host.querySelector('ui-skip-link')).toBeTruthy();
  });

  it('abre um unico drawer mobile, sem duplicar a sidebar fixa como segundo painel', async () => {
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
});
