import { Component, ChangeDetectionStrategy, input, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { formatCpfProgressive } from '../../utils/cpf-format.util';

/**
 * Input mascarado de CPF integrado a Reactive Forms via ControlValueAccessor.
 *
 * **Não valida o algoritmo do CPF** — apenas aplica máscara e propaga o valor
 * raw (11 dígitos) para o FormControl. Para validação semântica, componha com
 * `cpfValidator` de `@uniplus/shared-data`:
 *
 * @example
 * import { cpfValidator } from '@uniplus/shared-data';
 * new FormControl('', [Validators.required, cpfValidator]);
 */
@Component({
  selector: 'ui-cpf-input',
  standalone: true,
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
        class="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-govbr-primary focus:outline-none focus:ring-1 focus:ring-govbr-primary"
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
    const formatted = formatCpfProgressive(value);
    this.displayValue.set(formatted);
    this.rawValue = formatted.replace(/\D/g, '');
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
    const formatted = formatCpfProgressive(input.value);
    this.displayValue.set(formatted);
    this.rawValue = formatted.replace(/\D/g, '');
    input.value = formatted;
    this.onChange(this.rawValue);
  }
}
