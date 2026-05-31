import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';

let dialogIdSeed = 0;

@Component({
  selector: 'ui-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      class="uni-dialog"
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="headingId()"
      [attr.aria-describedby]="messageId()"
      (cancel)="onCancel($event)"
      (close)="onNativeClose()"
    >
      <div class="uni-dialog__panel">
        <div class="uni-dialog__header">
          <h3 [id]="headingId()" class="uni-dialog__title">{{ heading() }}</h3>
          <button
            #closeButton
            type="button"
            class="btn btn--tertiary btn--icon-only btn--rect"
            data-testid="confirm-dialog-close"
            aria-label="Fechar"
            (click)="onCancel()"
          >
            &times;
          </button>
        </div>
        <div class="uni-dialog__body">
          <p [id]="messageId()">{{ message() }}</p>
        </div>
        <div class="uni-dialog__footer">
          <button
            type="button"
            class="btn btn--tertiary"
            data-testid="confirm-dialog-cancel"
            (click)="onCancel()"
          >
            {{ cancelLabel() }}
          </button>
          <button
            type="button"
            data-testid="confirm-dialog-confirm"
            [attr.data-variant]="confirmVariant()"
            class="btn"
            [class.btn--danger]="confirmVariant() === 'danger'"
            (click)="onConfirm()"
          >
            {{ confirmLabel() }}
          </button>
          </div>
        </div>
    </dialog>
  `,
})
export class ConfirmDialogComponent {
  readonly visible = model<boolean>(false);
  readonly heading = input<string>('Confirmação');
  readonly message = input<string>('Deseja realmente prosseguir?');
  readonly confirmLabel = input<string>('Confirmar');
  readonly cancelLabel = input<string>('Cancelar');
  readonly confirmVariant = input<'primary' | 'danger'>('primary');

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly closeButtonRef = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  private lastFocusedElement: HTMLElement | null = null;

  /** IDs únicos por instância, garantindo aria-labelledby/describedby
   *  válidos quando múltiplos dialogs convivem no DOM. */
  private readonly idSuffix = ++dialogIdSeed;
  protected readonly headingId = computed(() => `ui-confirm-dialog-heading-${this.idSuffix}`);
  protected readonly messageId = computed(() => `ui-confirm-dialog-msg-${this.idSuffix}`);

  constructor() {
    effect(() => {
      const dialog = this.dialogRef()?.nativeElement;
      if (!dialog) return;

      if (this.visible()) {
        this.openDialog(dialog);
        return;
      }

      this.closeDialog(dialog);
    });
  }

  onConfirm(): void {
    this.confirmed.emit();
    this.visible.set(false);
  }

  onCancel(event?: Event): void {
    event?.preventDefault();
    this.cancelled.emit();
    this.visible.set(false);
  }

  protected onNativeClose(): void {
    if (this.visible()) {
      this.visible.set(false);
    }
    this.lastFocusedElement?.focus();
    this.lastFocusedElement = null;
  }

  private openDialog(dialog: HTMLDialogElement): void {
    if (dialog.open) return;
    this.lastFocusedElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    queueMicrotask(() => this.closeButtonRef()?.nativeElement.focus());
  }

  private closeDialog(dialog: HTMLDialogElement): void {
    if (!dialog.open) return;
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
      this.onNativeClose();
    }
  }
}
