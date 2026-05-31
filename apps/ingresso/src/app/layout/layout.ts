import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UserHeaderInfoComponent } from '@uniplus/shared-auth';
import { AppShellComponent, UiShellNavItem } from '@uniplus/shared-ui';

@Component({
  selector: 'ing-layout',
  standalone: true,
  imports: [RouterOutlet, UserHeaderInfoComponent, AppShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-app-shell
      appName="Ingresso — Uni+"
      subtitle="Chamadas, convocações e matrículas"
      footerLabel="CRCA — Unifesspa"
      [navItems]="navItems"
    >
      <auth-user-header-info uiShellActions />
      <router-outlet />
    </ui-app-shell>
  `,
})
export class LayoutComponent {
  protected readonly navItems: readonly UiShellNavItem[] = [
    { label: 'Dashboard', routerLink: '/dashboard', exact: true },
    { label: 'Chamadas', routerLink: '/chamadas' },
    { label: 'Convocações', routerLink: '/convocacoes' },
    { label: 'Matrículas', routerLink: '/matriculas' },
  ];
}
