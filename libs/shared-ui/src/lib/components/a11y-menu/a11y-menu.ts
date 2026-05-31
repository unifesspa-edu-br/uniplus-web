import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { createDisclosureController } from '@uniplus/shared-core/dom';

type UiTheme = 'auto' | 'light' | 'dark';

const STORE_KEY = 'uniplus.a11y';

type UiA11yState = {
  theme: UiTheme;
  contrast: boolean;
  fontMode: 'default' | 'legible';
};

@Component({
  selector: 'ui-a11y-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="a11y-menu" data-a11y-menu>
      <button
        #trigger
        class="a11y-menu__trigger"
        type="button"
        [attr.aria-expanded]="open() ? 'true' : 'false'"
        [attr.aria-controls]="popoverId"
        aria-label="Preferências de acessibilidade"
        data-a11y-menu-trigger
        (click)="toggle()"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.25"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="4" r="2" />
          <path d="M4 8h16M12 6v14M8 12l-2 8M16 12l2 8" />
        </svg>
      </button>
      <button
        class="a11y-menu__backdrop"
        type="button"
        hidden
        [hidden]="!open()"
        aria-hidden="true"
        tabindex="-1"
        (click)="close(true)"
      ></button>
      <div
        #popover
        class="a11y-menu__popover"
        [id]="popoverId"
        role="region"
        aria-label="Preferências de acessibilidade"
        [hidden]="!open()"
      >
        <p class="a11y-menu__title">Acessibilidade</p>
        <div class="a11y-menu__group" role="group" aria-label="Tema">
          <span class="a11y-menu__group-label">Tema</span>
          <div class="a11y-menu__options">
            <button
              class="a11y-opt"
              type="button"
              data-a11y="theme"
              data-value="light"
              [attr.aria-pressed]="theme() === 'light'"
              (click)="setTheme('light')"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="4" />
                <path
                  d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
                />
              </svg>
              Claro
            </button>
            <button
              class="a11y-opt"
              type="button"
              data-a11y="theme"
              data-value="dark"
              [attr.aria-pressed]="theme() === 'dark'"
              (click)="setTheme('dark')"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                aria-hidden="true"
              >
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
              Escuro
            </button>
            <button
              class="a11y-opt"
              type="button"
              data-a11y="theme"
              data-value="auto"
              [attr.aria-pressed]="theme() === 'auto'"
              (click)="setTheme('auto')"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
              Sistema
            </button>
          </div>
        </div>
        <div class="a11y-menu__group" role="group" aria-label="Ajustes de leitura">
          <span class="a11y-menu__group-label">Leitura</span>
          <div class="a11y-menu__options">
            <button
              class="a11y-opt"
              type="button"
              data-a11y="contrast"
              data-value="on"
              [attr.aria-pressed]="contrast()"
              (click)="contrast.update(toggleBool)"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2a10 10 0 100 20V2z" />
                <path d="M12 2a10 10 0 010 20" fill="none" stroke="currentColor" stroke-width="2" />
              </svg>
              Alto contraste
            </button>
            <button
              class="a11y-opt"
              type="button"
              data-a11y="font-mode"
              data-value="legible"
              [attr.aria-pressed]="legibleFont()"
              (click)="legibleFont.update(toggleBool)"
            >
              Fonte legível
            </button>
          </div>
        </div>
        <p class="a11y-menu__hint">
          Para ampliar o texto, use o zoom do navegador (<kbd>Ctrl</kbd> <kbd>+</kbd> /
          <kbd>Ctrl</kbd> <kbd>-</kbd>).
        </p>
      </div>
    </div>
  `,
})
export class A11yMenuComponent {
  private static idSeed = 0;
  protected readonly popoverId = `ui-a11y-menu-${++A11yMenuComponent.idSeed}`;
  private readonly document = inject(DOCUMENT);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly popoverRef = viewChild<ElementRef<HTMLElement>>('popover');
  private readonly triggerRef = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly initialState = readState();
  private readonly disclosure = createDisclosureController({
    document: this.document,
    host: this.host,
    panel: this.popoverRef,
    trigger: this.triggerRef,
  });

  protected readonly open = this.disclosure.open;
  protected readonly theme = signal<UiTheme>(this.initialState.theme);
  protected readonly contrast = signal(this.initialState.contrast);
  protected readonly legibleFont = signal(this.initialState.fontMode === 'legible');
  protected readonly effectiveTheme = computed(() => (this.contrast() ? 'contrast' : this.theme()));
  protected readonly toggleBool = (value: boolean) => !value;

  constructor() {
    effect(() => {
      const root = this.document.documentElement;
      root.dataset['theme'] = this.effectiveTheme();
      if (this.legibleFont()) {
        root.dataset['fontMode'] = 'legible';
      } else {
        delete root.dataset['fontMode'];
      }
      writeState({
        theme: this.theme(),
        contrast: this.contrast(),
        fontMode: this.legibleFont() ? 'legible' : 'default',
      });
    });
  }

  protected toggle(): void {
    this.disclosure.toggle();
  }

  protected close(returnFocus = false): void {
    this.disclosure.close(returnFocus);
  }

  protected setTheme(theme: UiTheme): void {
    this.theme.set(theme);
    this.contrast.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.disclosure.closeOnEscape();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    this.disclosure.closeOnDocumentClick(event);
  }
}

function readState(): UiA11yState {
  try {
    if (typeof localStorage === 'undefined') return defaultState();
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') as Partial<UiA11yState>;
    return {
      theme:
        parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'auto'
          ? parsed.theme
          : 'auto',
      contrast: parsed.contrast === true,
      fontMode: parsed.fontMode === 'legible' ? 'legible' : 'default',
    };
  } catch {
    return defaultState();
  }
}

function defaultState(): UiA11yState {
  return { theme: 'auto', contrast: false, fontMode: 'default' };
}

function writeState(value: UiA11yState): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORE_KEY, JSON.stringify(value));
    }
  } catch {
    // Storage can be unavailable in private browsing or SSR-like tests.
  }
}
