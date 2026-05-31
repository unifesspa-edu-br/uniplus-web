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
})
export class LoadingOverlayComponent {
  readonly visible = input<boolean>(false);
  readonly message = input<string>('Carregando...');
}
