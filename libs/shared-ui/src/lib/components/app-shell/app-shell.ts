import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { A11yMenuComponent } from '../a11y-menu/a11y-menu';
import { InstitutionalBarComponent } from '../institutional-bar/institutional-bar';
import { SkipLinkComponent } from '../skip-link/skip-link';
import { VlibrasLoaderComponent } from '../vlibras-loader/vlibras-loader';

export interface UiShellNavItem {
  label: string;
  routerLink: string | readonly unknown[];
  exact?: boolean;
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

      <header class="topbar" role="banner">
        <button
          type="button"
          class="topbar__menu-btn"
          aria-label="Abrir menu"
          [attr.aria-expanded]="drawerOpen() ? 'true' : 'false'"
          [attr.aria-controls]="drawerId"
          (click)="openDrawer()"
        >
          ☰
        </button>
        <div class="topbar__brand">
          <span class="topbar__mark" aria-hidden="true">U+</span>
          <div class="topbar__titles">
            <div class="topbar__title">{{ appName() }}</div>
            @if (subtitle()) {
              <div class="topbar__subtitle">{{ subtitle() }}</div>
            }
          </div>
        </div>
        <nav class="topbar__nav" aria-label="Navegação principal">
          @for (item of navItems(); track item.label) {
            <a
              [routerLink]="item.routerLink"
              routerLinkActive="is-active"
              [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
              ariaCurrentWhenActive="page"
            >
              {{ item.label }}
            </a>
          }
        </nav>
        <div class="topbar__actions">
          <ui-a11y-menu />
          <ng-content select="[uiShellActions]" />
        </div>
      </header>

      <dialog
        #drawer
        class="uni-drawer"
        [id]="drawerId"
        aria-label="Menu principal"
        (cancel)="closeDrawer($event)"
        (close)="drawerOpen.set(false)"
      >
        <div class="uni-drawer__panel">
          <div class="uni-drawer__header">
            <p class="uni-drawer__title">Menu</p>
            <button type="button" class="btn btn--tertiary btn--icon-only btn--rect" aria-label="Fechar menu" (click)="closeDrawer()">
              ×
            </button>
          </div>
          <div class="uni-drawer__body">
            <nav aria-label="Navegação principal">
              <ul class="uni-drawer__nav">
                @for (item of navItems(); track item.label) {
                  <li>
                    <a
                      [routerLink]="item.routerLink"
                      routerLinkActive="is-active"
                      [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
                      ariaCurrentWhenActive="page"
                      (click)="closeDrawer()"
                    >
                      {{ item.label }}
                    </a>
                  </li>
                }
              </ul>
            </nav>
          </div>
        </div>
      </dialog>

      <main class="ui-app-shell__main" [id]="mainId" tabindex="-1">
        <ng-content />
      </main>

      <footer class="ui-app-shell__footer">
        {{ footerLabel() }} &copy; {{ currentYear }}
      </footer>

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
  readonly footerLabel = input<string>('Uni+ — Unifesspa');
  readonly navItems = input<readonly UiShellNavItem[]>([]);

  protected readonly currentYear = new Date().getFullYear();
  protected readonly drawerOpen = signal(false);
  protected readonly drawerRef = viewChild<ElementRef<HTMLDialogElement>>('drawer');
  protected readonly drawerId = `ui-shell-drawer-${++shellIdSeed}`;
  protected readonly mainId = `ui-shell-main-${shellIdSeed}`;
  private readonly document = inject(DOCUMENT);
  private lastFocusedElement: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const drawer = this.drawerRef()?.nativeElement;
      if (!drawer) return;

      if (this.drawerOpen()) {
        this.showDrawer(drawer);
      } else {
        this.hideDrawer(drawer);
      }
    });
  }

  protected openDrawer(): void {
    this.drawerOpen.set(true);
  }

  protected closeDrawer(event?: Event): void {
    event?.preventDefault();
    this.drawerOpen.set(false);
  }

  private showDrawer(drawer: HTMLDialogElement): void {
    if (drawer.open) return;
    this.lastFocusedElement = this.document.activeElement instanceof HTMLElement
      ? this.document.activeElement
      : null;
    if (typeof drawer.showModal === 'function') {
      drawer.showModal();
    } else {
      drawer.setAttribute('open', '');
    }
  }

  private hideDrawer(drawer: HTMLDialogElement): void {
    if (!drawer.open) return;
    if (typeof drawer.close === 'function') {
      drawer.close();
    } else {
      drawer.removeAttribute('open');
    }
    this.lastFocusedElement?.focus();
    this.lastFocusedElement = null;
  }
}
