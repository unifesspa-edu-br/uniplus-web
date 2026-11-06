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
          [attr.aria-disabled]="disabled() ? 'true' : null"
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
  /**
   * Indisponível durante uma gravação ou recarga. Usa `aria-disabled`, e não `disabled`, para o
   * foco não se perder se o chip estiver focado quando o filtro trava: o clique é ignorado e o
   * leitor de tela anuncia o chip como indisponível.
   */
  readonly disabled = input<boolean>(false);

  protected select(value: string): void {
    if (this.disabled()) return;
    const next = this.selected() === value ? null : value;
    this.selected.set(next);
  }
}
