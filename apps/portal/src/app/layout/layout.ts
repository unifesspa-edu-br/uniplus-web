import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UserHeaderInfoComponent } from '@uniplus/shared-auth/components';
import { AppShellComponent, type UiShellNavGroup } from '@uniplus/shared-ui/shell';

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
        // De volta ao shell público — sem isso, quem entra por /recursos (única
        // rota que ainda vive neste shell) não tem como voltar à vitrine
        // exceto editando a URL. Documentos e Meu Perfil migraram pro shell
        // público (mesmo motivo de Minhas inscrições/Resultados).
        { label: 'Editais', routerLink: '/processos' },
      ],
    },
  ];
}
