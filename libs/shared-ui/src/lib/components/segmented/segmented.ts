import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface UiSegmentedOption<T extends string = string> {
  value: T;
  label: string;
}

@Component({
  selector: 'ui-segmented',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="segmented" role="group" [attr.aria-label]="accessibleName()">
      @for (option of choices(); track option.value) {
        <button
          type="button"
          class="segmented__btn"
          [attr.aria-pressed]="selectedValue() === option.value ? 'true' : 'false'"
          (click)="selectedValue.set(option.value)"
        >
          {{ option.label }}
        </button>
      }
    </div>
  `,
})
export class SegmentedComponent<T extends string = string> {
  readonly choices = input<readonly UiSegmentedOption<T>[]>([]);
  readonly accessibleName = input<string>('Alternar visualização');
  readonly selectedValue = model<T | null>(null);
}
