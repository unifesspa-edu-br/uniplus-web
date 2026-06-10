import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface UiFilterChipOption {
  readonly value: string;
  readonly label: string;
  readonly count?: number;
}

@Component({
  selector: 'ui-filter-chips',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="filter-chips" [attr.aria-label]="ariaLabel()">
      @for (option of options(); track option.value) {
        <button
          type="button"
          class="filter-chip"
          [attr.aria-pressed]="selected() === option.value ? 'true' : 'false'"
          (click)="select(option.value)"
        >
          <span>{{ option.label }}</span>
          @if (option.count !== undefined) {
            <span class="filter-chip__count">{{ option.count }}</span>
          }
        </button>
      }
    </div>
  `,
})
export class FilterChipsComponent {
  readonly options = input<readonly UiFilterChipOption[]>([]);
  readonly selected = model<string | null>(null);
  readonly ariaLabel = input<string>('Filtros rápidos');

  protected select(value: string): void {
    const next = this.selected() === value ? null : value;
    this.selected.set(next);
  }
}
