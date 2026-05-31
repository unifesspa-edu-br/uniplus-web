import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ui-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="spinner"
      [class.spinner--sm]="spinnerSize() === 'sm'"
      [class.spinner--md]="spinnerSize() === 'md'"
      [class.spinner--lg]="spinnerSize() === 'lg'"
      role="status"
      [attr.aria-label]="accessibleName()"
    ></span>
  `,
})
export class SpinnerComponent {
  readonly spinnerSize = input<'sm' | 'md' | 'lg'>('md');
  readonly accessibleName = input<string>('Carregando');
}
