import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ui-loading-overlay',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-white/80" role="alert" aria-busy="true">
        <div class="flex flex-col items-center gap-3">
          <div class="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-unifesspa-primary"></div>
          <p class="text-sm font-medium text-gray-600">{{ message() }}</p>
        </div>
      </div>
    }
  `,
})
export class LoadingOverlayComponent {
  readonly visible = input<boolean>(false);
  readonly message = input<string>('Carregando...');
}
