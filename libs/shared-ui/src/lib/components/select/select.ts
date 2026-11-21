import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  output,
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
      <label class="field__label" [class.is-required]="isRequired()" [for]="inputId()">
        {{ fieldLabel() }}
      </label>
      <select
        class="select"
        [id]="inputId()"
        [value]="value()"
        [disabled]="disabled()"
        [attr.required]="isRequired() ? '' : null"
        [attr.aria-required]="isRequired() ? 'true' : null"
        [attr.aria-invalid]="invalid() ? 'true' : null"
        [attr.aria-busy]="carregandoOpcoes() ? 'true' : null"
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
        <p class="field__hint" [id]="hintId()">{{ hint() }}</p>
      }
      @if (selectedDescription(); as description) {
        <p class="field__hint" [id]="descriptionId()">{{ description }}</p>
      }
      @if (errorMessage()) {
        <p class="field__error" [id]="errorId()" aria-live="polite">{{ errorMessage() }}</p>
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
  /** Id do `<select>`, para quem precisa focá-lo ou apontar para ele; sem ele, o componente gera um. */
  readonly idDoCampo = input<string | null>(null);
  /** Id de um aviso externo ao campo; é o primeiro da descrição do campo, antes de dica, descrição e erro. */
  readonly descritoPor = input<string | null>(null);
  /** Marca o campo como ocupado enquanto as opções ainda chegam; o campo continua habilitado. */
  readonly carregandoOpcoes = input<boolean>(false);
  /** Emite quando a pessoa escolhe uma opção; não emite quando o formulário escreve o valor. */
  readonly escolhido = output<void>();

  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  private readonly idGerado = `ui-select-${++selectIdSeed}`;
  protected readonly inputId = computed(() => this.idDoCampo() ?? this.idGerado);
  protected readonly hintId = computed(() => `${this.inputId()}-hint`);
  protected readonly descriptionId = computed(() => `${this.inputId()}-description`);
  protected readonly errorId = computed(() => `${this.inputId()}-error`);

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
      this.descritoPor(),
      this.hint() ? this.hintId() : null,
      this.selectedDescription() ? this.descriptionId() : null,
      this.errorMessage() ? this.errorId() : null,
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
    this.escolhido.emit();
  }
}
