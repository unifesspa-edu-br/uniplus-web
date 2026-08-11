import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type UiBulletVariant = 'primary' | 'neutral' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'ui-bullet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="bullet"
      [class.bullet--primary]="variant() === 'primary'"
      [class.bullet--success]="variant() === 'success'"
      [class.bullet--warning]="variant() === 'warning'"
      [class.bullet--danger]="variant() === 'danger'"
      [class.bullet--neutral]="variant() === 'neutral'"
    >
    </span>
  `,
})
export class BulletComponent {
  readonly variant = input<UiBulletVariant>('primary');
}
