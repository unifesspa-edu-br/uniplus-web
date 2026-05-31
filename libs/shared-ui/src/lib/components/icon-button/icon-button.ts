import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { UiButtonSize, UiButtonType, UiButtonVariant } from '../button/button';

@Component({
  selector: 'ui-icon-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      class="btn btn--icon-only"
      [class.btn--secondary]="variant() === 'secondary'"
      [class.btn--tertiary]="variant() === 'tertiary'"
      [class.btn--danger]="variant() === 'danger'"
      [class.btn--sm]="buttonSize() === 'sm'"
      [class.btn--md]="buttonSize() === 'md'"
      [class.btn--lg]="buttonSize() === 'lg'"
      [class.btn--circle]="buttonShape() === 'circle'"
      [class.btn--rect]="buttonShape() === 'rect'"
      [attr.type]="buttonType()"
      [attr.aria-label]="accessibleName()"
      [attr.aria-pressed]="pressed() === null ? null : pressed() ? 'true' : 'false'"
      [disabled]="isDisabled()"
    >
      <ng-content />
    </button>
  `,
})
export class IconButtonComponent {
  readonly accessibleName = input.required<string>();
  readonly variant = input<UiButtonVariant>('tertiary');
  readonly buttonSize = input<UiButtonSize>('md');
  readonly buttonShape = input<'circle' | 'rect'>('circle');
  readonly buttonType = input<UiButtonType>('button');
  readonly isDisabled = input<boolean>(false);
  readonly pressed = input<boolean | null>(null);
}
