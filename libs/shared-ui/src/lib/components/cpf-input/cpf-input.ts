import { Component, ChangeDetectionStrategy, input, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { formatCpfProgressive } from '@uniplus/shared-utils';

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
    <div class="field" [class.is-error]="invalid()">
      @if (fieldLabel()) {
        <label [for]="inputId()" class="field__label" [class.is-required]="isRequired()">
          {{ fieldLabel() }}
        </label>
      }
      <input
        [id]="inputId()"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        [placeholder]="placeholderText()"
        [value]="displayValue()"
        (input)="onInput($event)"
        (blur)="handleBlur()"
        [disabled]="disabled()"
        [attr.maxlength]="MASKED_LENGTH"
        [attr.aria-label]="fieldLabel() ? null : accessibleName()"
        [attr.aria-required]="isRequired() ? 'true' : null"
        [attr.required]="isRequired() ? '' : null"
        class="input"
        [attr.aria-invalid]="invalid() ? 'true' : null"
        [attr.aria-describedby]="invalid() ? inputId() + '-error' : null"
      />
      @if (invalid() && errorMessage()) {
        <small [id]="inputId() + '-error'" class="field__error" role="alert">
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

  readonly fieldLabel = input<string>('');
  readonly accessibleName = input<string>('CPF');
  readonly placeholderText = input<string>('000.000.000-00');
  readonly inputId = input<string>('cpf-input');
  readonly invalid = input<boolean>(false);
  readonly isRequired = input<boolean>(false);
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
