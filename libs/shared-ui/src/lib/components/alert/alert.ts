import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type UiAlertVariant = 'success' | 'warning' | 'danger' | 'info';

/**
 * Caixa de aviso. A região viva (`role="alert"`) cobre o título e a mensagem. O que tem estado
 * próprio, como o botão e a situação de uma nova tentativa, entra no slot `alertaAcoes`: fica
 * dentro da caixa, mas fora da região viva, para a mudança de estado não reler o aviso.
 */
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
    >
      <span class="alert__icon" aria-hidden="true">{{ icon() }}</span>
      <div class="alert__body">
        <div [attr.role]="role()" [attr.aria-live]="ariaLive()">
          @if (heading()) {
            <p class="alert__title">{{ heading() }}</p>
          }
          <p class="alert__msg"><ng-content /></p>
        </div>
        <ng-content select="[alertaAcoes]" />
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
