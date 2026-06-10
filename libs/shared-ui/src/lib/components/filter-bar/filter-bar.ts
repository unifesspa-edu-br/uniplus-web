import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ui-filter-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="filter-bar" role="search" [attr.aria-label]="ariaLabel()">
      <div class="filter-bar__row">
        <ng-content />
      </div>
    </section>
  `,
})
export class FilterBarComponent {
  readonly ariaLabel = input<string>('Filtros');
}
