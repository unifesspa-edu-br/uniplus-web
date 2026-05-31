import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ui-loading-overlay',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="ui-loading-overlay" role="alert" aria-busy="true">
        <div class="ui-loading-overlay__panel">
          <span class="spinner spinner--lg" aria-hidden="true"></span>
          <p class="u-body-sm">{{ message() }}</p>
        </div>
      </div>
    }
  `,
  styles: `
    .ui-loading-overlay {
      position: fixed;
      inset: 0;
      z-index: var(--z-modal);
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--surface-overlay);
      padding: var(--space-4);
    }

    .ui-loading-overlay__panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-5);
      background: var(--surface-elevated);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-3);
    }
  `,
})
export class LoadingOverlayComponent {
  readonly visible = input<boolean>(false);
  readonly message = input<string>('Carregando...');
}
