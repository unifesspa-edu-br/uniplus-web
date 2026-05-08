import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  ProblemDetails,
  ProblemI18nService,
  ProblemValidationError,
  idempotencyKey,
  withIdempotencyKey,
} from '@uniplus/shared-core';
import { CriarEditalCommand, EditaisApi } from '@uniplus/shared-data';
import { FormFieldComponent } from '@uniplus/shared-ui';

/**
 * Form Reactive tipado para criação de edital.
 *
 * Os tipos batem 1:1 com `CriarEditalCommand` do contrato V1, com a ressalva
 * de que `tipoProcesso` é `integer` no schema sem enum exposto — usado como
 * `number` no form com input numérico provisório enquanto o gap de contrato
 * (issue follow-up no `uniplus-api`) não é fechado.
 */
interface CriarEditalForm {
  numeroEdital: FormControl<number | null>;
  anoEdital: FormControl<number | null>;
  titulo: FormControl<string>;
  tipoProcesso: FormControl<number | null>;
  maximoOpcoesCurso: FormControl<number>;
}

/**
 * Container (ADR-0017) da feature Editais — criação via POST `/api/editais`.
 *
 * **Form-scoped Idempotency-Key (ADR-0014):** a key é gerada uma vez na
 * inicialização do form (signal) e reusada em retries enquanto o submit
 * estiver "ativo". Reset apenas após 201 sucesso. Em 422/409 a key é
 * preservada para permitir retry com correção do payload (replay protege
 * contra double-submit acidental).
 */
@Component({
  selector: 'sel-editais-create-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, FormFieldComponent],
  template: `
    <header class="mb-5">
      <h2 class="text-2xl font-bold text-gray-800">Novo edital</h2>
      <p class="text-sm text-gray-600">Cadastre os dados básicos do processo seletivo.</p>
    </header>

    @if (errorMessage()) {
      <div
        class="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        role="alert"
      >
        <span class="font-semibold">{{ errorMessage() }}</span>
      </div>
    }

    <form [formGroup]="form" (ngSubmit)="enviar()" novalidate class="grid max-w-2xl gap-4">
      <ui-form-field
        label="Número do edital"
        type="number"
        [control]="form.controls.numeroEdital"
        [errorMessage]="erroDoCampo('numeroEdital')"
      />

      <ui-form-field
        label="Ano"
        type="number"
        [control]="form.controls.anoEdital"
        [errorMessage]="erroDoCampo('anoEdital')"
      />

      <ui-form-field
        label="Título"
        type="text"
        [control]="form.controls.titulo"
        [errorMessage]="erroDoCampo('titulo')"
      />

      <ui-form-field
        label="Tipo de processo (código numérico)"
        type="number"
        [control]="form.controls.tipoProcesso"
        [errorMessage]="erroDoCampo('tipoProcesso')"
      />

      <ui-form-field
        label="Máximo de opções de curso"
        type="number"
        [min]="1"
        [max]="2"
        [control]="form.controls.maximoOpcoesCurso"
        [errorMessage]="erroDoCampo('maximoOpcoesCurso')"
      />

      <div class="mt-2 flex items-center justify-end gap-2">
        <a
          routerLink="/editais"
          class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          Cancelar
        </a>
        <button
          type="submit"
          [disabled]="submitting() || form.invalid"
          class="rounded-md bg-govbr-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-govbr-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {{ submitting() ? 'Enviando…' : 'Criar edital' }}
        </button>
      </div>
    </form>
  `,
})
export class EditaisCreatePage {
  private readonly api = inject(EditaisApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly submitting = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  /** Form-scoped key (ADR-0014). Gerada 1× na inicialização; reset após 201. */
  readonly idempotencyKeyAtual = signal<string>(idempotencyKey.create());

  readonly form: FormGroup<CriarEditalForm> = new FormGroup<CriarEditalForm>({
    numeroEdital: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(1)],
    }),
    anoEdital: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(2020), Validators.max(2099)],
    }),
    titulo: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
    tipoProcesso: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(1)],
    }),
    maximoOpcoesCurso: new FormControl<number>(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(2)],
    }),
  });

  protected enviar(): void {
    if (this.submitting()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const valor = this.form.getRawValue();
    const command: CriarEditalCommand = {
      numeroEdital: valor.numeroEdital ?? 0,
      anoEdital: valor.anoEdital ?? 0,
      titulo: valor.titulo,
      tipoProcesso: valor.tipoProcesso ?? 0,
      maximoOpcoesCurso: valor.maximoOpcoesCurso,
    };

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.api
      .criar(command, withIdempotencyKey(this.idempotencyKeyAtual()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.submitting.set(false);
        if (result.ok) {
          // Reset da key após sucesso — próximo submit ganha key nova.
          this.idempotencyKeyAtual.set(idempotencyKey.create());
          this.router.navigate(['/editais']);
          return;
        }
        this.aplicarFalha(result.problem);
      });
  }

  protected erroDoCampo(nome: keyof CriarEditalForm): string | null {
    const ctrl = this.form.controls[nome];
    if (!ctrl.touched && !ctrl.dirty) {
      return null;
    }
    if (ctrl.hasError('backend')) {
      const backend = ctrl.getError('backend') as { code: string; message: string };
      return backend.message;
    }
    if (ctrl.hasError('required')) return 'Campo obrigatório.';
    if (ctrl.hasError('min')) return 'Valor abaixo do permitido.';
    if (ctrl.hasError('max')) return 'Valor acima do permitido.';
    if (ctrl.hasError('minlength')) return 'Texto muito curto.';
    return null;
  }

  private aplicarFalha(problem: ProblemDetails): void {
    if (problem.status === 422 && problem.errors && problem.errors.length > 0) {
      this.aplicarErrosDeValidacao(problem.errors);
      return;
    }
    this.errorMessage.set(this.problemI18n.resolve(problem).title);
  }

  private aplicarErrosDeValidacao(
    errors: ReadonlyArray<ProblemValidationError>,
  ): void {
    let aplicouAlgum = false;
    for (const erro of errors) {
      const campo = erro.field as keyof CriarEditalForm;
      const ctrl = this.form.controls[campo];
      if (!ctrl) continue;
      ctrl.setErrors({ backend: { code: erro.code, message: erro.message } });
      ctrl.markAsTouched();
      aplicouAlgum = true;
    }
    // Errors[] sem field reconhecido cai num banner geral pra não silenciar feedback.
    if (!aplicouAlgum) {
      this.errorMessage.set('Não foi possível mapear os erros de validação. Revise os campos.');
    }
  }
}
