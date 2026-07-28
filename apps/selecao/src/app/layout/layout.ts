import { Component, ChangeDetectionStrategy, inject, DestroyRef, signal, computed } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { UserHeaderInfoComponent } from '@uniplus/shared-auth/components';
import { A11yMenuComponent, InstitutionalBarComponent, SkipLinkComponent, VlibrasLoaderComponent } from '@uniplus/shared-ui';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import {
  AuthService,
  UserContextService,
  DOMAIN_ROLES,
  ROLE_LABELS,
} from '@uniplus/shared-auth/bootstrap';

interface ConfigNavItem {
  readonly label: string;
  readonly icon: string;
  readonly routerLink?: string;
  readonly exact?: boolean;
}

interface ConfigNavGroup {
  readonly label: string;
  readonly items: readonly ConfigNavItem[];
}

@Component({
  selector: 'sel-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    UserHeaderInfoComponent,
    InstitutionalBarComponent,
    SkipLinkComponent,
    VlibrasLoaderComponent,
    A11yMenuComponent,
    RouterLink,
    RouterLinkActive,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-skip-link targetId="cfg-main" linkText="Pular para o conteúdo principal" />
    <ui-institutional-bar organization="UNIFESSPA · Administração" />
    <div
      class="admin-shell"
      [attr.data-sidebar-mobile]="sidebarMobileOpen() ? 'open' : null"
      [attr.data-sidebar-desktop]="sidebarDesktopOpen() ? 'open' : 'closed'"
    >
      <aside
        class="sidebar"
        id="cfg-admin-sidebar"
        aria-label="Painel administrativo"
        [attr.aria-hidden]="sidebarHidden() ? 'true' : null"
        [attr.inert]="sidebarHidden() ? '' : null"
      >
        <div class="sidebar__brand">
          <div class="sidebar__mark" aria-hidden="true">U+</div>
          <div class="sidebar__brand-copy">
            <div class="sidebar__brand-title">Uni+</div>
            <div class="sidebar__brand-sub">CEPS · Seleção</div>
          </div>
          <button
            type="button"
            class="sidebar__close"
            aria-label="Fechar menu lateral"
            (click)="closeSidebar()"
          >
            <i class="pi pi-times" aria-hidden="true"></i>
          </button>
        </div>

        <nav aria-label="Navegação administrativa">
          @for (group of navGroups; track group.label) {
            <div class="sidebar__label">{{ group.label }}</div>
            @for (item of group.items; track item.label) {
              @if (item.routerLink) {
                <a
                  [routerLink]="item.routerLink"
                  routerLinkActive="is-active"
                  [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
                  ariaCurrentWhenActive="page"
                  (click)="closeSidebar()"
                >
                  <i [class]="'pi ' + item.icon" aria-hidden="true"></i>
                  <span>{{ item.label }}</span>
                </a>
              } @else {
                <span class="sidebar__link is-disabled" aria-disabled="true">
                  <i [class]="'pi ' + item.icon" aria-hidden="true"></i>
                  <span>{{ item.label }}</span>
                </span>
              }
            }
          }
        </nav>

        @if (userContext.user(); as profile) {
          <footer class="sidebar__bottom" aria-label="Usuário autenticado">
            <div class="avatar avatar--sm sidebar__avatar" aria-hidden="true">
              {{ sidebarUserInitials() }}
            </div>
            <div class="sidebar__user-info">
              <strong>{{ userContext.displayName() }}</strong>
              <span>{{ sidebarUserRole() || '@' + profile.username }}</span>
            </div>
          </footer>
        }
      </aside>

      <button
        type="button"
        class="sidebar-backdrop"
        aria-hidden="true"
        tabindex="-1"
        (click)="closeSidebar()"
      ></button>

      <div class="admin-main">
        <header class="admin-topbar" role="banner">
          <button
            type="button"
            class="sidebar-toggle"
            [attr.aria-label]="sidebarToggleLabel()"
            aria-controls="cfg-admin-sidebar"
            [attr.aria-expanded]="sidebarExpanded() ? 'true' : 'false'"
            (click)="toggleSidebar()"
          >
            <i class="pi pi-bars" aria-hidden="true"></i>
          </button>

          <nav class="breadcrumb" aria-label="Breadcrumb">
            <ol class="breadcrumb__list">
              <li class="breadcrumb__item">
                <a class="breadcrumb__link" routerLink="/dashboard">Início</a>
              </li>
              <li class="breadcrumb__item">
                <a class="breadcrumb__link" routerLink="/dashboard">Painel</a>
              </li>
              <li class="breadcrumb__item">
                <span class="breadcrumb__current" aria-current="page">{{ breadcrumbAtual() }}</span>
              </li>
            </ol>
          </nav>

          <div class="cfg-topbar-actions">
            <ui-a11y-menu />
            <auth-user-header-info />
          </div>
        </header>

        <main id="cfg-main" class="page" tabindex="-1">
          <router-outlet />
        </main>
      </div>
    </div>
    <ui-vlibras-loader />
  `,
})
export class LayoutComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly userContext = inject(UserContextService);
  /**
   * Última folha do breadcrumb ("Início → Configuração → {atual}"), derivada do
   * `data.breadcrumb` da rota ativada mais profunda. Reage a cada navegação;
   * default "Unidade" (rota inicial). Mantém o breadcrumb coerente com a página
   * em foco (CA-10 da story de Instituição).
   */
  protected readonly breadcrumbAtual = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.breadcrumbDaRotaAtiva()),
    ),
    { initialValue: this.breadcrumbDaRotaAtiva() },
  );
  private readonly desktopMedia =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 1024px)')
      : null;

  protected readonly isDesktop = signal(this.desktopMedia?.matches ?? false);
  protected readonly sidebarMobileOpen = signal(false);
  protected readonly sidebarDesktopOpen = signal(true);
  protected readonly sidebarExpanded = computed(() =>
    this.isDesktop() ? this.sidebarDesktopOpen() : this.sidebarMobileOpen(),
  );
  protected readonly sidebarHidden = computed(() => !this.isDesktop() && !this.sidebarMobileOpen());
  protected readonly sidebarToggleLabel = computed(() =>
    this.sidebarExpanded() ? 'Fechar menu lateral' : 'Abrir menu lateral',
  );
  protected readonly sidebarUserInitials = computed(() => initials(this.userContext.displayName()));
  protected readonly sidebarUserRole = computed(() => {
    const role = this.authService.roles().find((value) => DOMAIN_ROLES.has(value));
    return role ? (ROLE_LABELS[role] ?? role) : '';
  });

  protected readonly navGroups: readonly ConfigNavGroup[] = [
    {
      label: 'Painéis',
      items: [
        { label: 'Painel de processos', icon: 'pi-table', routerLink: '/dashboard' },
        { label: 'Processo seletivos', icon: 'pi-file', },
        { label: 'Inscrições', icon: 'pi-user' },
        { label: 'Homologação', icon: 'pi-sitemap' },
      ],
    },
  ];

  constructor() {
    if (this.desktopMedia === null) return;

    const syncDesktop = (event?: MediaQueryListEvent): void => {
      this.isDesktop.set(event?.matches ?? this.desktopMedia?.matches ?? false);
      this.sidebarMobileOpen.set(false);
    };

    syncDesktop();
    this.desktopMedia.addEventListener('change', syncDesktop);
    this.destroyRef.onDestroy(() => {
      this.desktopMedia?.removeEventListener('change', syncDesktop);
    });
  }

  protected toggleSidebar(): void {
    if (this.isDesktop()) {
      this.sidebarDesktopOpen.update((open) => !open);
      return;
    }

    this.sidebarMobileOpen.update((open) => !open);
  }

  protected closeSidebar(): void {
    this.sidebarMobileOpen.set(false);
  }

  private breadcrumbDaRotaAtiva(): string {
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let label = 'Visão Geral';
    while (route !== null) {
      const breadcrumb = route.data['breadcrumb'];
      if (typeof breadcrumb === 'string') {
        label = breadcrumb;
      }
      route = route.firstChild;
    }
    return label;
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
