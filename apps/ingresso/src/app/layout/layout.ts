import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UserHeaderInfoComponent } from '@uniplus/shared-auth/components';
import { AppShellComponent, type UiShellNavGroup } from '@uniplus/shared-ui/shell';

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
      [navGroups]="navGroups"
    >
      <auth-user-header-info uiShellActions />
      <router-outlet />
    </ui-app-shell>
  `,
})
export class LayoutComponent {
  protected readonly navGroups: readonly UiShellNavGroup[] = [
    {
      label: 'Navegação',
      items: [
        { label: 'Dashboard', routerLink: '/dashboard', exact: true },
        { label: 'Chamadas', routerLink: '/chamadas' },
        { label: 'Convocações', routerLink: '/convocacoes' },
        { label: 'Matrículas', routerLink: '/matriculas' },
      ],
    },
  ];
}
