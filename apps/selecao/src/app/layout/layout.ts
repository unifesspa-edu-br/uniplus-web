import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import {
  AuthService,
  DOMAIN_ROLES,
  ROLE_LABELS,
  UserContextService,
} from '@uniplus/shared-auth/bootstrap';
import { UserHeaderInfoComponent } from '@uniplus/shared-auth/components';
import {
  AppShellComponent,
  UiShellBreadcrumbItem,
  UiShellNavGroup,
} from '@uniplus/shared-ui/shell';

interface SelNavItem {
  readonly label: string;
  readonly icon: string;
  readonly routerLink?: string;
  readonly exact?: boolean;
  readonly roles?: readonly string[];
}

interface SelNavGroup {
  readonly label: string;
  readonly items: readonly SelNavItem[];
}

@Component({
  selector: 'sel-layout',
  standalone: true,
  imports: [RouterOutlet, AppShellComponent, UserHeaderInfoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-app-shell
      appName="Uni+"
      subtitle="CEPS · Seleção"
      [navGroups]="navGroups()"
      [breadcrumb]="breadcrumb()"
    >
      <ng-container ngProjectAs="[uiShellActions]">
        <auth-user-header-info />
      </ng-container>
      <ng-container ngProjectAs="[uiShellUser]">
        <div class="avatar avatar--sm sidebar__avatar" aria-hidden="true">
          {{ sidebarUserInitials() }}
        </div>
        <div class="sidebar__user-info">
          <strong>{{ userContext.displayName() }}</strong>
          <span>{{ sidebarUserRole() }}</span>
        </div>
      </ng-container>
      <router-outlet />
    </ui-app-shell>
  `,
})
export class LayoutComponent {
  private readonly authService = inject(AuthService);
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
  protected readonly sidebarUserRole = computed(() => {
    const role = this.authService.roles().find((value) => DOMAIN_ROLES.has(value));
    return role ? (ROLE_LABELS[role] ?? role) : '';
  });

  private readonly navGroupsDeclarados: readonly SelNavGroup[] = [
    {
      label: 'Painéis',
      items: [
        { label: 'Painel de processos', icon: 'pi-table', routerLink: '/dashboard' },
        {
          label: 'Processo seletivo',
          icon: 'pi-file',
          routerLink: '/processo-seletivo',
          roles: ['plataforma-admin'],
        },
        {
          label: 'Inscrições',
          icon: 'pi-user',
          routerLink: '/inscricoes',
          roles: ['admin', 'gestor'],
        },
        {
          label: 'Homologação',
          icon: 'pi-sitemap',
          routerLink: '/homologacao',
          roles: ['admin', 'gestor', 'avaliador'],
        },
      ],
    },
  ];

  protected readonly navGroups = computed<readonly UiShellNavGroup[]>(() => {
    const papeis = new Set(this.authService.roles());
    return this.navGroupsDeclarados
      .map((grupo) => ({
        ...grupo,
        items: grupo.items.filter(
          (item) => item.roles === undefined || item.roles.some((papel) => papeis.has(papel)),
        ),
      }))
      .filter((grupo) => grupo.items.length > 0);
  });

  private breadcrumbDaRotaAtiva(): UiShellBreadcrumbItem[] {
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let label = 'Visão Geral';
    while (route !== null) {
      const breadcrumb = route.data['breadcrumb'];
      if (typeof breadcrumb === 'string') label = breadcrumb;
      route = route.firstChild;
    }
    return [{ label: 'Início', routerLink: '/dashboard' }, { label }];
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
