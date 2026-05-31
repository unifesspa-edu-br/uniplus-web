import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UserHeaderInfoComponent } from '@uniplus/shared-auth/components/user-header-info.component';
import { AppShellComponent, type UiShellNavItem } from '@uniplus/shared-ui/components/app-shell/app-shell';

@Component({
  selector: 'sel-layout',
  standalone: true,
  imports: [RouterOutlet, UserHeaderInfoComponent, AppShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-app-shell
      appName="Seleção — Uni+"
      subtitle="Gestão de processos seletivos"
      footerLabel="CEPS — Unifesspa"
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
    { label: 'Editais', routerLink: '/editais' },
    { label: 'Inscrições', routerLink: '/inscricoes' },
    { label: 'Homologação', routerLink: '/homologacao' },
    { label: 'Notas', routerLink: '/notas' },
    { label: 'Classificação', routerLink: '/classificacao' },
  ];
}
