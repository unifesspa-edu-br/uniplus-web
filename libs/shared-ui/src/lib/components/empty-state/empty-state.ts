import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ui-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty-state" [class.empty-state--error]="variant() === 'error'" role="status">
      @if (showIcon()) {
        <div class="empty-state__icon" aria-hidden="true">{{ variant() === 'error' ? '!' : 'i' }}</div>
      }
      @if (level() === 2) {
        <h2 class="empty-state__title">{{ heading() }}</h2>
      } @else {
        <h3 class="empty-state__title">{{ heading() }}</h3>
      }
      @if (description()) {
        <p class="empty-state__desc">{{ description() }}</p>
      }
      <ng-content />
    </div>
  `,
})
export class EmptyStateComponent {
  readonly heading = input.required<string>();
  readonly description = input<string>('');
  readonly variant = input<'default' | 'error'>('default');
  readonly showIcon = input<boolean>(true);
  readonly level = input<2 | 3>(2);
}
