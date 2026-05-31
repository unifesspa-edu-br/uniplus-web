import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ui-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card" [class.card--interactive]="interactive()" [attr.tabindex]="interactive() ? 0 : null">
      <ng-content />
    </article>
  `,
})
export class CardComponent {
  readonly interactive = input<boolean>(false);
}
