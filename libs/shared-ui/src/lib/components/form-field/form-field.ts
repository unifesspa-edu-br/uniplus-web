import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

let formFieldIdSeed = 0;

/**
 * Apresentacional (ADR-0017): wrapper de campo de formulário com label,
 * input nativo, mensagem de erro inline e a11y (ARIA) consistente.
 *
 * **Por que receber `FormControl` em vez de `formControlName`:** caller
 * passa a referência do controle direto (ex.: `form.controls.titulo`),
 * preservando tipo via `FormControl<T>` e evitando o overhead de
 * `ControlValueAccessor`/`NgControl` que seria necessário para `formControlName`.
 * Pattern reusável em formulários tipados sem perder type-safety.
 *
 * **A11y:** label/input/erro vinculados via IDs únicos por instância
 * (counter privado), `aria-invalid`/`aria-describedby` setados quando
 * `errorMessage` truthy. Compatível com WCAG 2.1 AA + e-MAG 3.1.
 *
 * **Container resolve o `errorMessage`** — pode vir de validators padrão
 * (`erroDoCampo()` helper na page) ou de `setErrors({ backend: {...} })`
 * vindo de 422 do backend (ADR-0014 form-scoped strategy).
 */
@Component({
  selector: 'ui-form-field',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label [for]="inputId" class="mb-1 block text-sm font-medium text-gray-700">
      {{ label() }}
    </label>
    <input
      [id]="inputId"
      [type]="type()"
      [formControl]="control()"
      [attr.placeholder]="placeholder() || null"
      [attr.min]="min() ?? null"
      [attr.max]="max() ?? null"
      [attr.aria-invalid]="errorMessage() ? 'true' : null"
      [attr.aria-describedby]="describedBy()"
      class="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-unifesspa-primary"
    />
    <!-- Erro e hint sempre renderizados (com [hidden]) — garantem que o ID
         existe no DOM antes que aria-describedby o referencie, evitando gap
         para leitores de tela (NVDA/JAWS) na primeira exibição de erro.
         aria-live="polite" no erro anuncia a mensagem ao aparecer (WCAG
         2.1 SC 4.1.3 Status Messages, e-MAG 3.1). -->
    <p
      [id]="errorId"
      [hidden]="!errorMessage()"
      class="mt-1 text-xs text-red-700"
      aria-live="polite"
    >
      {{ errorMessage() }}
    </p>
    <p
      [id]="hintId"
      [hidden]="!!errorMessage() || !hint()"
      class="mt-1 text-xs text-gray-500"
    >
      {{ hint() }}
    </p>
  `,
})
export class FormFieldComponent {
  readonly label = input.required<string>();
  /**
   * `FormControl` tipado — caller passa via `[control]="form.controls.<nome>"`.
   * Aceitar `FormControl<unknown>` permite que callers preservem o tipo
   * narrow sem cast. Internamente o wrapper só lê valor/erros.
   */
  readonly control = input.required<FormControl<unknown>>();
  readonly type = input<string>('text');
  readonly placeholder = input<string>('');
  readonly errorMessage = input<string | null>(null);
  readonly hint = input<string | null>(null);
  readonly min = input<number | null>(null);
  readonly max = input<number | null>(null);

  /**
   * IDs únicos por instância — counter privado ao módulo. Valores fixos
   * pós-construção; expostos como `readonly` simples (não signals) porque
   * nunca mudam — evita overhead reativo. Pattern simétrico ao usado em
   * `ConfirmDialogComponent`.
   */
  private readonly idSuffix = ++formFieldIdSeed;
  protected readonly inputId = `ui-form-field-input-${this.idSuffix}`;
  protected readonly errorId = `ui-form-field-error-${this.idSuffix}`;
  protected readonly hintId = `ui-form-field-hint-${this.idSuffix}`;

  /**
   * `aria-describedby` aponta para erro quando presente, hint caso contrário,
   * ou null. Garante leitor de tela leia a única mensagem ativa. Como ambos
   * `<p>` estão sempre no DOM (controlados por `[hidden]`), a referência é
   * sempre válida.
   */
  protected readonly describedBy = computed<string | null>(() => {
    if (this.errorMessage()) return this.errorId;
    if (this.hint()) return this.hintId;
    return null;
  });
}
