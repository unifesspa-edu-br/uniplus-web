import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface UiSelectOption<T extends string = string> {
  value: T;
  label: string;
  /** Texto de apoio que aparece abaixo do campo enquanto a opção está escolhida. */
  description?: string;
  disabled?: boolean;
}

let selectIdSeed = 0;

@Component({
  selector: 'ui-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field" [class.is-error]="invalid()">
      <label class="field__label" [class.is-required]="isRequired()" [for]="inputId">
        {{ fieldLabel() }}
      </label>
      <select
        class="select"
        [id]="inputId"
        [value]="value()"
        [disabled]="disabled()"
        [attr.required]="isRequired() ? '' : null"
        [attr.aria-required]="isRequired() ? 'true' : null"
        [attr.aria-invalid]="invalid() ? 'true' : null"
        [attr.aria-describedby]="describedBy()"
        (change)="onChangeFromDom($event)"
        (blur)="onTouched()"
      >
        @if (valueOutsideOptions()) {
          <!-- Sem opção marcada, o navegador marcaria a primeira e a tela mostraria o que o controle não tem. -->
          <option value="" disabled hidden [selected]="true"></option>
        }
        @if (placeholderText()) {
          <option value="" [selected]="value() === ''">{{ placeholderText() }}</option>
        }
        @for (option of choices(); track option.value) {
          <!-- As opções podem chegar depois do valor: marcar a escolhida mantém a seleção. -->
          <option
            [value]="option.value"
            [selected]="option.value === value()"
            [disabled]="option.disabled ?? false"
          >
            {{ option.label }}
          </option>
        }
      </select>
      @if (hint()) {
        <p class="field__hint" [id]="hintId">{{ hint() }}</p>
      }
      @if (selectedDescription(); as description) {
        <p class="field__hint" [id]="descriptionId">{{ description }}</p>
      }
      @if (errorMessage()) {
        <p class="field__error" [id]="errorId" aria-live="polite">{{ errorMessage() }}</p>
      }
    </div>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true,
    },
  ],
})
export class SelectComponent<T extends string = string> implements ControlValueAccessor {
  readonly fieldLabel = input.required<string>();
  readonly choices = input<readonly UiSelectOption<T>[]>([]);
  readonly placeholderText = input<string>('');
  readonly hint = input<string>('');
  readonly errorMessage = input<string>('');
  readonly invalid = input<boolean>(false);
  readonly isRequired = input<boolean>(false);

  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  protected readonly inputId = `ui-select-${++selectIdSeed}`;
  protected readonly hintId = `${this.inputId}-hint`;
  protected readonly descriptionId = `${this.inputId}-description`;
  protected readonly errorId = `${this.inputId}-error`;

  protected readonly valueOutsideOptions = computed(() => {
    const value = this.value();
    if (this.placeholderText() && value === '') return false;
    return !this.choices().some((option) => option.value === value);
  });
  protected readonly selectedDescription = computed(
    () => this.choices().find((option) => option.value === this.value())?.description ?? '',
  );
  protected readonly describedBy = computed(() => {
    const ids = [
      this.hint() ? this.hintId : null,
      this.selectedDescription() ? this.descriptionId : null,
      this.errorMessage() ? this.errorId : null,
    ].filter((id) => id !== null);
    return ids.length > 0 ? ids.join(' ') : null;
  });

  protected onChange: (value: string) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(value: string | null | undefined): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onChangeFromDom(event: Event): void {
    const next = (event.target as HTMLSelectElement).value;
    this.value.set(next);
    this.onChange(next);
  }
}
