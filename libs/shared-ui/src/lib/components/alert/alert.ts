import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type UiAlertVariant = 'success' | 'warning' | 'danger' | 'info';

@Component({
  selector: 'ui-alert',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="alert"
      [class.alert--success]="variant() === 'success'"
      [class.alert--warning]="variant() === 'warning'"
      [class.alert--danger]="variant() === 'danger'"
      [class.alert--info]="variant() === 'info'"
      [attr.role]="role()"
      [attr.aria-live]="ariaLive()"
    >
      <span class="alert__icon" aria-hidden="true">{{ icon() }}</span>
      <div class="alert__body">
        @if (heading()) {
          <p class="alert__title">{{ heading() }}</p>
        }
        <p class="alert__msg"><ng-content /></p>
      </div>
    </div>
  `,
})
export class AlertComponent {
  readonly variant = input<UiAlertVariant>('info');
  readonly heading = input<string>('');
  readonly dynamic = input<boolean>(true);

  protected readonly role = computed(() => (this.dynamic() ? 'alert' : null));
  protected readonly ariaLive = computed(() => {
    if (!this.dynamic()) return null;
    return this.variant() === 'danger' ? 'assertive' : 'polite';
  });
  protected readonly icon = computed(() => {
    const icons: Record<UiAlertVariant, string> = {
      success: '✓',
      warning: '!',
      danger: '!',
      info: 'i',
    };
    return icons[this.variant()];
  });
}
