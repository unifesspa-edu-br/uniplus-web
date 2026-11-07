import { ElementRef, Signal, WritableSignal, signal } from '@angular/core';

export type UiDisclosureRef<T extends HTMLElement = HTMLElement> =
  Signal<ElementRef<T> | undefined>;

export interface UiDisclosureControllerOptions<
  TPanel extends HTMLElement = HTMLElement,
  TTrigger extends HTMLElement = HTMLElement,
> {
  readonly document: Document;
  readonly host: ElementRef<HTMLElement>;
  readonly panel: UiDisclosureRef<TPanel>;
  readonly trigger: UiDisclosureRef<TTrigger>;
  readonly initialFocusSelector?: string;
}

export interface UiDisclosureController {
  readonly open: WritableSignal<boolean>;
  toggle(): void;
  openPanel(): void;
  close(returnFocus?: boolean): void;
  closeOnDocumentClick(event: MouseEvent): void;
  closeOnEscape(): void;
}

const DEFAULT_INITIAL_FOCUS_SELECTOR = 'button, [href], input, select, textarea';

class PainelRetratil implements UiDisclosureController {
  readonly open = signal(false);
  private readonly initialFocusSelector: string;

  constructor(private readonly options: UiDisclosureControllerOptions) {
    this.initialFocusSelector =
      options.initialFocusSelector ?? DEFAULT_INITIAL_FOCUS_SELECTOR;
  }

  toggle(): void {
    if (this.open()) {
      this.close(true);
      return;
    }
    this.openPanel();
  }

  openPanel(): void {
    this.open.set(true);
    this.focusFirstControl();
  }

  close(returnFocus = false): void {
    const focusWasInside = this.options
      .panel()
      ?.nativeElement.contains(this.options.document.activeElement);
    this.open.set(false);
    if (returnFocus || focusWasInside) {
      this.options.trigger()?.nativeElement.focus();
    }
  }

  closeOnDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    const target = event.target;
    const { document, host } = this.options;
    if (isDocumentNode(document, target) && !host.nativeElement.contains(target)) {
      this.close(false);
    }
  }

  closeOnEscape(): void {
    if (this.open()) this.close(true);
  }

  private focusFirstControl(): void {
    setTimeout(() => {
      this.options
        .panel()
        ?.nativeElement.querySelector<HTMLElement>(this.initialFocusSelector)
        ?.focus();
    }, 0);
  }
}

export function createDisclosureController(
  options: UiDisclosureControllerOptions,
): UiDisclosureController {
  return new PainelRetratil(options);
}

function isDocumentNode(documentRef: Document, value: unknown): value is Node {
  const nodeCtor = documentRef.defaultView?.Node ?? globalThis.Node;
  return typeof nodeCtor !== 'undefined' && value instanceof nodeCtor;
}
