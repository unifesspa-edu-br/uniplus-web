import { Component, ChangeDetectionStrategy, input, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'ui-cpf-input',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-1">
      @if (label()) {
        <label [for]="inputId()" class="text-sm font-medium text-gray-700">
          {{ label() }}
        </label>
      }
      <input
        [id]="inputId()"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        [placeholder]="placeholder()"
        [value]="displayValue()"
        (input)="onInput($event)"
        (blur)="handleBlur()"
        [disabled]="disabled()"
        [attr.maxlength]="MASKED_LENGTH"
        [attr.aria-label]="label() ? null : ariaLabel()"
        [attr.aria-required]="required() ? 'true' : null"
        [attr.required]="required() ? '' : null"
        class="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-unifesspa-primary focus:outline-none focus:ring-1 focus:ring-unifesspa-primary"
        [class.border-red-500]="invalid()"
        [attr.aria-invalid]="invalid()"
        [attr.aria-describedby]="invalid() ? inputId() + '-error' : null"
      />
      @if (invalid() && errorMessage()) {
        <small [id]="inputId() + '-error'" class="text-xs text-red-600">
          {{ errorMessage() }}
        </small>
      }
    </div>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CpfInputComponent),
      multi: true,
    },
  ],
})
export class CpfInputComponent implements ControlValueAccessor {
  protected readonly MASKED_LENGTH = 14;
  private static readonly DIGIT_LENGTH = 11;

  readonly label = input<string>('');
  readonly ariaLabel = input<string>('CPF');
  readonly placeholder = input<string>('000.000.000-00');
  readonly inputId = input<string>('cpf-input');
  readonly invalid = input<boolean>(false);
  readonly required = input<boolean>(false);
  readonly errorMessage = input<string>('');
  readonly disabled = signal(false);
  readonly displayValue = signal('');
  private rawValue = '';

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null | undefined): void {
    this.rawValue = this.toRawDigits(value);
    this.displayValue.set(this.formatCpf(this.rawValue));
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

  protected handleBlur(): void {
    this.onTouched();
  }

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.rawValue = this.toRawDigits(input.value);
    this.displayValue.set(this.formatCpf(this.rawValue));
    input.value = this.displayValue();
    this.onChange(this.rawValue);
  }

  private toRawDigits(value: string | null | undefined): string {
    return (value ?? '').replace(/\D/g, '').slice(0, CpfInputComponent.DIGIT_LENGTH);
  }

  private formatCpf(value: string): string {
    if (value.length <= 3) return value;
    if (value.length <= 6) return `${value.slice(0, 3)}.${value.slice(3)}`;
    if (value.length <= 9) return `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`;
    return `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`;
  }
}
