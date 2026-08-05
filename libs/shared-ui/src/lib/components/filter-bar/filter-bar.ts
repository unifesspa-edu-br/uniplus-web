import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

@Component({
  selector: 'ui-filter-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="filter-bar" role="search" [attr.aria-label]="ariaLabel()">
      <div class="filter-bar__row">
        <div class="input-group">
          <span class="input-group__addon" aria-hidden="true">
            <i class="pi pi-search"></i>
          </span>
          <input
            type="search"
            class="input"
            [placeholder]="searchPlaceholder()"
            [attr.aria-label]="searchAriaLabel() || null"
            [value]="searchValue()"
            (input)="searchValue.set($any($event.target).value)"
          />
        </div>
        <ng-content select="[uiFilterBarActions]" />
      </div>
      <div class="filter-bar__group">
        <ng-content select="[uiFilterBarSecondary]" />
      </div>
    </div>
  `,
})
export class FilterBarComponent {
  readonly ariaLabel = input.required<string>();
  readonly searchPlaceholder = input<string>('Buscar...');
  readonly searchAriaLabel = input<string>('');
  readonly searchValue = model<string>('');
}
