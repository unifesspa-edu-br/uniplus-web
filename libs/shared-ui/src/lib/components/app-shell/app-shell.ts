import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { A11yMenuComponent } from '../a11y-menu/a11y-menu';
import { InstitutionalBarComponent } from '../institutional-bar/institutional-bar';
import { SkipLinkComponent } from '../skip-link/skip-link';
import { VlibrasLoaderComponent } from '../vlibras-loader/vlibras-loader';

export interface UiShellNavItem {
  label: string;
  icon?: string;
  routerLink?: string | readonly unknown[];
  exact?: boolean;
  disabled?: boolean;
}

export interface UiShellNavGroup {
  label: string;
  items: readonly UiShellNavItem[];
}

export interface UiShellBreadcrumbItem {
  label: string;
  routerLink?: string | readonly unknown[];
}

let shellIdSeed = 0;

@Component({
  selector: 'ui-app-shell',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    A11yMenuComponent,
    InstitutionalBarComponent,
    SkipLinkComponent,
    VlibrasLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui-app-shell">
      <ui-skip-link [targetId]="mainId" />
      <ui-institutional-bar
        [organization]="organization()"
        [siteMapHref]="siteMapHref()"
        [accessibilityHref]="accessibilityHref()"
        [privacyHref]="privacyHref()"
      />
      <div
        class="admin-shell"
        [attr.data-sidebar-mobile]="sidebarMobileOpen() ? 'open' : null"
        [attr.data-sidebar-desktop]="sidebarDesktopOpen() ? 'open' : 'closed'"
      >
        <aside
          class="sidebar"
          [id]="sidebarId"
          aria-label="Painel administrativo"
          [attr.aria-hidden]="sidebarHidden() ? 'true' : null"
          [attr.inert]="sidebarHidden() ? '' : null"
        >
          <div class="sidebar__brand">
            <div class="sidebar__mark" aria-hidden="true">U+</div>
            <div class="sidebar__brand-copy">
              <div class="sidebar__brand-title">{{ appName() }}</div>
              @if (subtitle()) {
                <div class="sidebar__brand-sub">{{ subtitle() }}</div>
              }
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
            @for (group of navGroups(); track group.label) {
              <div class="sidebar__label">{{ group.label }}</div>
              @for (item of group.items; track item.label) {
                @if (item.routerLink && !item.disabled) {
                  <a
                    [routerLink]="item.routerLink"
                    routerLinkActive="is-active"
                    [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
                    ariaCurrentWhenActive="page"
                    (click)="closeSidebarIfMobile()"
                  >
                    @if (item.icon) {
                      <i [class]="'pi ' + item.icon" aria-hidden="true"></i>
                    }
                    <span>{{ item.label }}</span>
                  </a>
                } @else {
                  <span class="sidebar__link is-disabled" aria-disabled="true">
                    <i [class]="'pi ' + (item.icon ?? 'pi-circle')" aria-hidden="true"></i>
                    <span>{{ item.label }}</span>
                  </span>
                }
              }
            }
          </nav>
          <footer class="sidebar__bottom" aria-label="Usuário autenticado">
            @if (footerLabel()) { <span class="ui-app-shell__footer-label">{{ footerLabel() }}</span> }
            <ng-content select="[uiShellUser]" />
          </footer>
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
              class="sidebar-toggle sidebar-toggle--compacto"
              [attr.aria-label]="sidebarMobileOpen() ? 'Fechar menu lateral' : 'Abrir menu lateral'"
              [attr.aria-controls]="sidebarId"
              [attr.aria-expanded]="sidebarMobileOpen() ? 'true' : 'false'"
              (click)="toggleMobileSidebar()"
            >
              <i class="pi pi-bars" aria-hidden="true"></i>
            </button>
            <button
              type="button"
              class="sidebar-toggle sidebar-toggle--amplo"
              [attr.aria-label]="
                sidebarDesktopOpen() ? 'Recolher menu lateral' : 'Expandir menu lateral'
              "
              [attr.aria-controls]="sidebarId"
              [attr.aria-expanded]="sidebarDesktopOpen() ? 'true' : 'false'"
              (click)="toggleDesktopSidebar()"
            >
              <i class="pi pi-bars" aria-hidden="true"></i>
            </button>
            <nav class="breadcrumb" aria-label="Breadcrumb">
              <ol class="breadcrumb__list">
                @for (item of breadcrumb(); track $index; let last = $last) {
                  <li class="breadcrumb__item">
                    @if (item.routerLink && !last) {
                      <a class="breadcrumb__link" [routerLink]="item.routerLink">
                        {{ item.label }}
                      </a>
                    } @else {
                      <span class="breadcrumb__current" aria-current="page">
                        {{ item.label }}
                      </span>
                    }
                  </li>
                }
              </ol>
            </nav>
            <div class="shell-topbar-actions">
              <ui-a11y-menu />
              <ng-content select="[uiShellActions]" />
            </div>
          </header>
          <main class="page" [id]="mainId" tabindex="-1">
            <ng-content />
          </main>
        </div>
      </div>
      <ui-vlibras-loader />
    </div>
  `,
})
export class AppShellComponent {
  readonly appName = input.required<string>();
  readonly subtitle = input<string>('');
  readonly organization = input<string>('UNIFESSPA · Sistema Uni+');
  readonly siteMapHref = input<string | null>(null);
  readonly accessibilityHref = input<string | null>(null);
  readonly privacyHref = input<string | null>(null);
  readonly navGroups = input<readonly UiShellNavGroup[]>([]);
  readonly breadcrumb = input<readonly UiShellBreadcrumbItem[]>([]);
  readonly footerLabel = input<string>('');

  protected readonly sidebarMobileOpen = signal(false);
  protected readonly sidebarDesktopOpen = signal(true);
  protected readonly sidebarExpanded = computed(
    () => this.sidebarMobileOpen() || this.sidebarDesktopOpen(),
  );
  protected readonly sidebarHidden = computed(() => !this.sidebarExpanded());
  protected readonly shellId = `ui-shell-${++shellIdSeed}`;
  protected readonly sidebarId = `${this.shellId}-sidebar`;
  protected readonly mainId = `${this.shellId}-main`;

  private readonly document = inject(DOCUMENT);
  private lastFocusedElement: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (this.sidebarMobileOpen()) {
        this.lastFocusedElement =
          this.document.activeElement instanceof HTMLElement ? this.document.activeElement : null;
        return;
      }
      if (this.lastFocusedElement !== null) {
        this.lastFocusedElement.focus();
        this.lastFocusedElement = null;
      }
    });
  }

  protected closeSidebarIfMobile(): void {
    if (this.sidebarMobileOpen()) this.sidebarMobileOpen.set(false);
  }
  protected toggleMobileSidebar(): void {
    this.sidebarMobileOpen.update((open) => !open);
  }
  protected toggleDesktopSidebar(): void {
    this.sidebarDesktopOpen.update((open) => !open);
  }
  protected closeSidebar(): void {
    this.sidebarMobileOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.sidebarMobileOpen()) this.sidebarMobileOpen.set(false);
  }
}
