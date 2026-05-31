import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let textInputIdSeed = 0;

@Component({
  selector: 'ui-text-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field" [class.is-error]="invalid()">
      <label class="field__label" [class.is-required]="isRequired()" [for]="inputId">
        {{ fieldLabel() }}
      </label>
      <input
        class="input"
        [id]="inputId"
        [type]="inputType()"
        [value]="value()"
        [placeholder]="placeholderText()"
        [disabled]="disabled()"
        [attr.required]="isRequired() ? '' : null"
        [attr.aria-required]="isRequired() ? 'true' : null"
        [attr.aria-invalid]="invalid() ? 'true' : null"
        [attr.aria-describedby]="describedBy()"
        (input)="onInput($event)"
        (blur)="onTouched()"
      />
      @if (hint()) {
        <p class="field__hint" [id]="hintId">{{ hint() }}</p>
      }
      @if (errorMessage()) {
        <p class="field__error" [id]="errorId" aria-live="polite">{{ errorMessage() }}</p>
      }
    </div>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextInputComponent),
      multi: true,
    },
  ],
})
export class TextInputComponent implements ControlValueAccessor {
  readonly fieldLabel = input.required<string>();
  readonly inputType = input<'text' | 'email' | 'password' | 'search' | 'tel' | 'url'>('text');
  readonly placeholderText = input<string>('');
  readonly hint = input<string>('');
  readonly errorMessage = input<string>('');
  readonly invalid = input<boolean>(false);
  readonly isRequired = input<boolean>(false);

  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  protected readonly inputId = `ui-text-input-${++textInputIdSeed}`;
  protected readonly hintId = `${this.inputId}-hint`;
  protected readonly errorId = `${this.inputId}-error`;

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

  protected onInput(event: Event): void {
    const next = (event.target as HTMLInputElement).value;
    this.value.set(next);
    this.onChange(next);
  }

  protected describedBy(): string | null {
    const ids: string[] = [];
    if (this.hint()) ids.push(this.hintId);
    if (this.errorMessage()) ids.push(this.errorId);
    return ids.length > 0 ? ids.join(' ') : null;
  }
}
