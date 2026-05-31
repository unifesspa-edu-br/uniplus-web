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

export function createDisclosureController(
  options: UiDisclosureControllerOptions,
): UiDisclosureController {
  const open = signal(false);
  const initialFocusSelector =
    options.initialFocusSelector ?? DEFAULT_INITIAL_FOCUS_SELECTOR;

  const focusFirstControl = (): void => {
    setTimeout(() => {
      const first = options.panel()
        ?.nativeElement
        .querySelector<HTMLElement>(initialFocusSelector);
      first?.focus();
    }, 0);
  };

  const openPanel = (): void => {
    open.set(true);
    focusFirstControl();
  };

  const close = (returnFocus = false): void => {
    const focusWasInside = options.panel()
      ?.nativeElement
      .contains(options.document.activeElement);
    open.set(false);
    if (returnFocus || focusWasInside) {
      options.trigger()?.nativeElement.focus();
    }
  };

  return {
    open,
    toggle(): void {
      if (open()) {
        close(true);
        return;
      }
      openPanel();
    },
    openPanel,
    close,
    closeOnDocumentClick(event: MouseEvent): void {
      if (!open()) return;
      const target = event.target;
      if (isDocumentNode(options.document, target) && !options.host.nativeElement.contains(target)) {
        close(false);
      }
    },
    closeOnEscape(): void {
      if (open()) close(true);
    },
  };
}

function isDocumentNode(documentRef: Document, value: unknown): value is Node {
  const nodeCtor = documentRef.defaultView?.Node ?? globalThis.Node;
  return typeof nodeCtor !== 'undefined' && value instanceof nodeCtor;
}
