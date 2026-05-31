import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  viewChild,
} from '@angular/core';
import { createDisclosureController } from '@uniplus/shared-core/dom';
import { AuthService, UserContextService, type UserRole } from '@uniplus/shared-auth/bootstrap';

const DOMAIN_ROLES = new Set<string>([
  'admin',
  'gestor',
  'avaliador',
  'candidato',
] satisfies UserRole[]);

/**
 * Bloco de identificação do usuário autenticado para uso em headers.
 * Exibe nome social (ou civil), username, roles do realm e menu de conta.
 * Renderiza vazio quando não há sessão ativa — seguro para uso em
 * layouts que misturam rotas públicas e autenticadas.
 */
@Component({
  selector: 'auth-user-header-info',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (userContext.user(); as profile) {
      <div class="menu-wrapper ui-user-menu">
        <button
          #trigger
          type="button"
          class="user-chip"
          [id]="buttonId"
          aria-haspopup="menu"
          [attr.aria-expanded]="menuOpen() ? 'true' : 'false'"
          [attr.aria-controls]="menuId"
          [attr.aria-label]="'Abrir menu da conta de ' + userContext.displayName()"
          (click)="toggleMenu()"
          (keydown)="onTriggerKeydown($event)"
        >
          <span class="user-chip__avatar" aria-hidden="true">{{
            initials(userContext.displayName())
          }}</span>
          <span class="ui-user-header__text">
            <strong>{{ userContext.displayName() }}</strong>
            <span>
              &#64;{{ profile.username }}
              @if (domainRoles(profile.roles); as roles) {
                @if (roles.length) {
                  · {{ roles.join(', ') }}
                }
              }
            </span>
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <ul
          #menu
          class="menu"
          role="menu"
          [id]="menuId"
          [attr.aria-labelledby]="buttonId"
          [hidden]="!menuOpen()"
        >
          <li class="menu__group-title" role="presentation">Conta</li>
          <li role="none">
            <button
              type="button"
              class="menu__item menu__item--danger"
              role="menuitem"
              (keydown)="onMenuKeydown($event)"
              (click)="logout()"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              Sair
            </button>
          </li>
        </ul>
      </div>
    }
  `,
})
export class UserHeaderInfoComponent {
  private static idSeed = 0;

  protected readonly userContext = inject(UserContextService);
  private readonly authService = inject(AuthService);
  private readonly document = inject(DOCUMENT);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly triggerRef = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly menuRef = viewChild<ElementRef<HTMLElement>>('menu');
  private readonly disclosure = createDisclosureController({
    document: this.document,
    host: this.host,
    panel: this.menuRef,
    trigger: this.triggerRef,
    initialFocusSelector: '[role="menuitem"]',
  });

  protected readonly menuOpen = this.disclosure.open;
  protected readonly buttonId = `auth-user-menu-button-${++UserHeaderInfoComponent.idSeed}`;
  protected readonly menuId = `auth-user-menu-${UserHeaderInfoComponent.idSeed}`;

  protected domainRoles(roles: string[]): string[] {
    return roles.filter((r) => DOMAIN_ROLES.has(r));
  }

  protected initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  protected toggleMenu(): void {
    this.disclosure.toggle();
  }

  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    this.disclosure.openPanel();
  }

  protected onMenuKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.disclosure.close(true);
      return;
    }

    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const items = this.menuItems();
    if (!items.length) return;

    const currentIndex = items.indexOf(this.document.activeElement as HTMLElement);
    const last = items.length - 1;
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? last
          : event.key === 'ArrowUp'
            ? currentIndex <= 0
              ? last
              : currentIndex - 1
            : currentIndex >= last
              ? 0
              : currentIndex + 1;

    items[nextIndex]?.focus();
  }

  protected logout(): void {
    this.disclosure.close(false);
    void this.authService.logout();
  }

  private menuItems(): HTMLElement[] {
    return Array.from(
      this.menuRef()?.nativeElement.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    this.disclosure.closeOnDocumentClick(event);
  }

  @HostListener('document:keydown.escape')
  protected onDocumentEscape(): void {
    this.disclosure.closeOnEscape();
  }
}
