import { Component, ChangeDetectionStrategy, input, output, model } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ui-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
        <div class="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <h3 class="text-lg font-semibold text-gray-900">{{ title() }}</h3>
          <p class="mt-2 text-sm text-gray-600">{{ message() }}</p>
          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              (click)="onCancel()"
            >
              {{ cancelLabel() }}
            </button>
            <button
              type="button"
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

  onConfirm(): void {
    this.confirmed.emit();
    this.visible.set(false);
  }

  onCancel(): void {
    this.cancelled.emit();
    this.visible.set(false);
  }
}
