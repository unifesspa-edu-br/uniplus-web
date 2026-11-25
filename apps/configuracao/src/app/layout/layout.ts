import { MENU_LATERAL, type ItemDoMenu } from './menu-lateral';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { PermissoesService, UserContextService } from '@uniplus/shared-auth/bootstrap';
import { PerfisDaBarraComponent, UserHeaderInfoComponent } from '@uniplus/shared-auth/components';
import {
  AppShellComponent,
  UiShellBreadcrumbItem,
  UiShellNavGroup,
} from '@uniplus/shared-ui/shell';
import type { CodigoDePermissao } from '@uniplus/shared-auth/bootstrap';
import { CaminhoDeTela, PERMISSOES_DAS_TELAS } from '../acesso/permissoes-das-telas';

@Component({
  selector: 'cfg-layout',
  standalone: true,
  imports: [RouterOutlet, AppShellComponent, UserHeaderInfoComponent, PerfisDaBarraComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-app-shell
      appName="Uni+"
      subtitle="Configuração"
      [navGroups]="navGroups()"
      [breadcrumb]="breadcrumb()"
    >
      <ng-container ngProjectAs="[uiShellActions]">
        <auth-user-header-info />
      </ng-container>
      <ng-container ngProjectAs="[uiShellUser]">
        @if (userContext.user(); as profile) {
          <div class="avatar avatar--sm sidebar__avatar" aria-hidden="true">
            {{ sidebarUserInitials() }}
          </div>
          <div class="sidebar__user-info">
            <strong>{{ userContext.displayName() }}</strong>
            <auth-perfis-da-barra [username]="profile.username" />
          </div>
        }
      </ng-container>
      <router-outlet />
    </ui-app-shell>
  `,
})
export class LayoutComponent {
  private readonly permissoes = inject(PermissoesService);
  private readonly router = inject(Router);
  protected readonly userContext = inject(UserContextService);

  protected readonly breadcrumb = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.breadcrumbDaRotaAtiva()),
    ),
    { initialValue: this.breadcrumbDaRotaAtiva() },
  );

  protected readonly sidebarUserInitials = computed(() => initials(this.userContext.displayName()));

  protected readonly navGroups = computed<readonly UiShellNavGroup[]>(() =>
    MENU_LATERAL.map((grupo) => ({
      ...grupo,
      items: grupo.items.filter((item) => this.permitido(item)),
    })).filter((grupo) => grupo.items.length > 0),
  );

  private permitido(item: ItemDoMenu): boolean {
    const caminho = item.routerLink?.slice(1) as CaminhoDeTela | undefined;
    if (caminho === undefined) return true;
    const exigidas: readonly CodigoDePermissao[] = PERMISSOES_DAS_TELAS[caminho];
    return exigidas.length === 0 || this.permissoes.temAlguma(...exigidas);
  }

  private breadcrumbDaRotaAtiva(): UiShellBreadcrumbItem[] {
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let label = 'Unidade';
    while (route !== null) {
      const breadcrumb = route.data['breadcrumb'];
      if (typeof breadcrumb === 'string') label = breadcrumb;
      route = route.firstChild;
    }
    return [{ label: 'Início', routerLink: '/' }, { label }];
  }
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
