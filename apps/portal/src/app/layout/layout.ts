import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UserHeaderInfoComponent } from '@uniplus/shared-auth/components';
import { AppShellComponent, type UiShellNavItem } from '@uniplus/shared-ui/shell';

@Component({
  selector: 'ptl-layout',
  standalone: true,
  imports: [RouterOutlet, UserHeaderInfoComponent, AppShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-app-shell
      appName="Portal do Candidato — Unifesspa"
      subtitle="Acompanhamento de processos e inscrições"
      footerLabel="Uni+ — Unifesspa"
      [navItems]="navItems"
    >
      <auth-user-header-info uiShellActions />
      <router-outlet />
    </ui-app-shell>
  `,
})
export class LayoutComponent {
  protected readonly navItems: readonly UiShellNavItem[] = [
    { label: 'Processos', routerLink: '/processos' },
    { label: 'Acompanhamento', routerLink: '/acompanhamento' },
    { label: 'Documentos', routerLink: '/documentos' },
    { label: 'Meu Perfil', routerLink: '/perfil' },
  ];
}
