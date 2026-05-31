import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type UiButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger';
export type UiButtonSize = 'sm' | 'md' | 'lg';
export type UiButtonType = 'button' | 'submit' | 'reset';

@Component({
  selector: 'ui-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      class="btn"
      [class.btn--secondary]="variant() === 'secondary'"
      [class.btn--tertiary]="variant() === 'tertiary'"
      [class.btn--danger]="variant() === 'danger'"
      [class.btn--sm]="buttonSize() === 'sm'"
      [class.btn--md]="buttonSize() === 'md'"
      [class.btn--lg]="buttonSize() === 'lg'"
      [class.btn--full]="full()"
      [class.btn--rect]="buttonShape() === 'rect'"
      [attr.type]="buttonType()"
      [disabled]="isDisabled() || isLoading()"
      [attr.aria-busy]="isLoading() ? 'true' : null"
      [attr.data-loading]="isLoading() ? 'true' : null"
    >
      @if (isLoading()) {
        <span class="spinner spinner--sm" aria-hidden="true"></span>
      }
      <span><ng-content /></span>
    </button>
  `,
})
export class ButtonComponent {
  readonly variant = input<UiButtonVariant>('primary');
  readonly buttonSize = input<UiButtonSize>('md');
  readonly buttonShape = input<'pill' | 'rect'>('pill');
  readonly buttonType = input<UiButtonType>('button');
  readonly full = input<boolean>(false);
  readonly isDisabled = input<boolean>(false);
  readonly isLoading = input<boolean>(false);
}
