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
      [attr.role]="decorativo() ? null : 'status'"
      [attr.aria-hidden]="decorativo() ? 'true' : null"
      [attr.aria-label]="decorativo() ? null : accessibleName()"
    ></span>
  `,
})
export class SpinnerComponent {
  readonly spinnerSize = input<'sm' | 'md' | 'lg'>('md');
  readonly accessibleName = input<string>('Carregando');
  /** O texto ao lado, ou outra região viva, já diz que carrega: o indicador não fala junto. */
  readonly decorativo = input(false);
}
