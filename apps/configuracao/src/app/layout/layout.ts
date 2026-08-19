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

interface CfgNavItem {
  readonly label: string;
  readonly icon: string;
  readonly routerLink?: string;
  readonly exact?: boolean;
}

interface CfgNavGroup {
  readonly label: string;
  readonly items: readonly CfgNavItem[];
}

@Component({
  selector: 'cfg-layout',
  standalone: true,
  imports: [RouterOutlet, AppShellComponent, UserHeaderInfoComponent],
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
            <span>{{ sidebarUserRole() || '@' + profile.username }}</span>
          </div>
        }
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

  private readonly navGroupsDeclarados: readonly CfgNavGroup[] = [
    {
      label: 'Painéis',
      items: [
        { label: 'Painel de processos', icon: 'pi-table', routerLink: '/dashboard' },
        { label: 'Editais', icon: 'pi-file' },
        { label: 'Inscrições', icon: 'pi-user' },
        { label: 'Homologação', icon: 'pi-sitemap' },
      ],
    },
    {
      label: 'Resultados',
      items: [
        { label: 'Classificação', icon: 'pi-chart-line' },
        { label: 'Recursos', icon: 'pi-check-circle' },
      ],
    },
    {
      label: 'Configuração',
      items: [
        { label: 'Cidade', icon: 'pi-map-marker' },
        { label: 'Campus', icon: 'pi-building', routerLink: '/campi', exact: true },
        { label: 'Local de oferta', icon: 'pi-map', routerLink: '/locais-oferta', exact: true },
        { label: 'Instituição', icon: 'pi-warehouse', routerLink: '/instituicao', exact: true },
        { label: 'Unidade', icon: 'pi-sitemap', routerLink: '/unidades', exact: true },
        { label: 'Curso', icon: 'pi-book', routerLink: '/cursos', exact: true },
        {
          label: 'Oferta de curso',
          icon: 'pi-file-edit',
          routerLink: '/ofertas-curso',
          exact: true,
        },
        { label: 'Modalidade', icon: 'pi-users', routerLink: '/modalidades' },
        {
          label: 'Tipo de Documento',
          icon: 'pi-id-card',
          routerLink: '/tipos-documento',
          exact: true,
        },
        {
          label: 'Termo de Consentimento',
          icon: 'pi-file-edit',
          routerLink: '/termos-consentimento',
          exact: true,
        },
        {
          label: 'Condição de Atendimento',
          icon: 'pi-heart',
          routerLink: '/condicoes-atendimento',
        },
        {
          label: 'Recurso de Acessibilidade',
          icon: 'pi-wrench',
          routerLink: '/recursos-acessibilidade',
        },
        { label: 'Tipo de Deficiência', icon: 'pi-stop', routerLink: '/tipos-deficiencia' },
        {
          label: 'Fase Canônica',
          icon: 'pi-star',
          routerLink: '/fases-canonicas',
          exact: true,
        },
        { label: 'Tipo de Banca', icon: 'pi-shield', routerLink: '/tipos-banca', exact: true },
        {
          label: 'Precedência de Fase',
          icon: 'pi-sort-alt',
          routerLink: '/precedencias-fase',
          exact: true,
        },
        {
          label: 'Reserva Demográfica',
          icon: 'pi-chart-bar',
          routerLink: '/reserva-demografica',
          exact: true,
        },
        { label: 'Peso ENEM', icon: 'pi-sliders-h', routerLink: '/pesos-enem', exact: true },
        { label: 'Calendários', icon: 'pi-calendar', routerLink: '/calendario-dias-uteis' },
      ],
    },
  ];

  protected readonly navGroups = computed<readonly UiShellNavGroup[]>(
    () => this.navGroupsDeclarados,
  );

  private breadcrumbDaRotaAtiva(): UiShellBreadcrumbItem[] {
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let label = 'Unidade';
    while (route !== null) {
      const breadcrumb = route.data['breadcrumb'];
      if (typeof breadcrumb === 'string') label = breadcrumb;
      route = route.firstChild;
    }
    return [{ label: 'Início', routerLink: '/unidades' }, { label }];
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
