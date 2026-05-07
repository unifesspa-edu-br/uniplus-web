import { Component, ChangeDetectionStrategy, computed, input, output, model } from '@angular/core';
import { CommonModule } from '@angular/common';

let dialogIdSeed = 0;

@Component({
  selector: 'ui-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId()"
        [attr.aria-describedby]="messageId()"
      >
        <div class="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <h3 [id]="titleId()" class="text-lg font-semibold text-gray-900">{{ title() }}</h3>
          <p [id]="messageId()" class="mt-2 text-sm text-gray-600">{{ message() }}</p>
          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              data-testid="confirm-dialog-cancel"
              class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              (click)="onCancel()"
            >
              {{ cancelLabel() }}
            </button>
            <button
              type="button"
              data-testid="confirm-dialog-confirm"
              [attr.data-variant]="confirmVariant()"
              class="rounded-md px-4 py-2 text-sm font-medium text-white"
              [ngClass]="confirmVariant() === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-unifesspa-primary hover:bg-blue-800'"
              (click)="onConfirm()"
            >
              {{ confirmLabel() }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialogComponent {
  readonly visible = model<boolean>(false);
  readonly title = input<string>('Confirmação');
  readonly message = input<string>('Deseja realmente prosseguir?');
  readonly confirmLabel = input<string>('Confirmar');
  readonly cancelLabel = input<string>('Cancelar');
  readonly confirmVariant = input<'primary' | 'danger'>('primary');

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  /** IDs únicos por instância, garantindo aria-labelledby/describedby
   *  válidos quando múltiplos dialogs convivem no DOM. */
  private readonly idSuffix = ++dialogIdSeed;
  protected readonly titleId = computed(() => `ui-confirm-dialog-title-${this.idSuffix}`);
  protected readonly messageId = computed(() => `ui-confirm-dialog-msg-${this.idSuffix}`);

  onConfirm(): void {
    this.confirmed.emit();
    this.visible.set(false);
  }

  onCancel(): void {
    this.cancelled.emit();
    this.visible.set(false);
  }
}
