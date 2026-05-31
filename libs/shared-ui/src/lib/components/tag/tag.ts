import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type UiTagVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

@Component({
  selector: 'ui-tag',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="tag"
      [class.tag--primary]="variant() === 'primary'"
      [class.tag--success]="variant() === 'success'"
      [class.tag--warning]="variant() === 'warning'"
      [class.tag--danger]="variant() === 'danger'"
      [class.tag--info]="variant() === 'info'"
      [class.tag--solid]="solid()"
    >
      @if (dot()) {
        <span class="tag__dot" aria-hidden="true"></span>
      }
      <ng-content />
    </span>
  `,
})
export class TagComponent {
  readonly variant = input<UiTagVariant>('neutral');
  readonly solid = input<boolean>(false);
  readonly dot = input<boolean>(false);
}
