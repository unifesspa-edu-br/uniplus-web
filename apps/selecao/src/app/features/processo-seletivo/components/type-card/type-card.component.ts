import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TipoProcessoOption } from '../../steps/processo-seletivo.models';

@Component({
  selector: 'sel-type-card',
  standalone: true,
  styleUrl: './type-card.component.css',
  template: `
    <label class="type-card" [class.is-selected]="selected()">
      <input
        class="sr-only"
        type="radio"
        name="tipo-edital"
        [value]="option().value"
        [checked]="selected()"
        (change)="selectChange.emit(option().value)"
      />
      <div class="type-card__head">
        <span class="type-card__name">{{ option().name }}</span>
        <svg
          aria-hidden="true"
          class="type-card__check"
          fill="none"
          height="20"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-width="2.5"
          viewBox="0 0 24 24"
          width="20"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
      @if (option().description) {
        <p class="type-card__desc">{{ option().description }}</p>
      }
      @if (option().tags.length) {
        <div class="type-card__tags">
          @for (tag of option().tags; track tag) {
            <span class="type-card__tag">{{ tag }}</span>
          }
        </div>
      }
      @if (option().legal) {
        <span class="type-card__legal">{{ option().legal }}</span>
      }
    </label>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypeCardComponent {
  readonly option = input.required<TipoProcessoOption>();
  readonly selected = input(false);
  readonly selectChange = output<string>();
}
