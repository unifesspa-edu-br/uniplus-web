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
        [placeholder]="placeholder()"
        [value]="displayValue()"
        (input)="onInput($event)"
        (blur)="onTouched()"
        [disabled]="disabled()"
        maxlength="14"
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
  readonly label = input<string>('');
  readonly placeholder = input<string>('000.000.000-00');
  readonly inputId = input<string>('cpf-input');
  readonly invalid = input<boolean>(false);
  readonly errorMessage = input<string>('');
  readonly disabled = signal(false);
  readonly displayValue = signal('');
  private rawValue = '';

  // noop — substituída por registerOnChange
  private onChange: (value: string) => void = () => undefined;
  // noop — substituída por registerOnTouched
  onTouched: () => void = () => undefined;

  writeValue(value: string): void {
    this.rawValue = (value || '').replace(/\D/g, '');
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

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.rawValue = input.value.replace(/\D/g, '').substring(0, 11);
    this.displayValue.set(this.formatCpf(this.rawValue));
    input.value = this.displayValue();
    this.onChange(this.rawValue);
  }

  private formatCpf(value: string): string {
    if (value.length <= 3) return value;
    if (value.length <= 6) return `${value.slice(0, 3)}.${value.slice(3)}`;
    if (value.length <= 9) return `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`;
    return `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9, 11)}`;
  }
}
