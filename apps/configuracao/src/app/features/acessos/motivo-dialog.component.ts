import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { AlertComponent, DialogComponent, SpinnerComponent } from '@uniplus/shared-ui/components';

/** Limite do motivo na API, para a recusa de pedido e a revogação de concessão. */
export const LIMITE_DO_MOTIVO = 500;

/**
 * Diálogo que pede o motivo de um ato que fica na trilha (recusar um pedido, revogar uma
 * concessão). Quem o hospeda faz a chamada e informa `erro` e `enviando`.
 */
@Component({
  selector: 'cfg-motivo-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, AlertComponent, DialogComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-dialog [(visible)]="visible" [heading]="heading()" [dismissible]="!enviando()">
      @if (erro()) {
        <ui-alert variant="danger" heading="Não foi possível concluir">{{ erro() }}</ui-alert>
      }
      <label class="field" [class.is-error]="tentou() && motivo.invalid">
        <span class="field__label is-required">Motivo</span>
        <textarea
          class="textarea"
          [formControl]="motivo"
          [attr.maxlength]="limite"
          [attr.aria-invalid]="tentou() && motivo.invalid ? 'true' : null"
          [attr.aria-describedby]="'cfg-motivo-ajuda'"
        ></textarea>
        <span id="cfg-motivo-ajuda" class="field__hint">{{ ajuda() }}</span>
        @if (tentou() && motivo.invalid) {
          <span class="field__error">Informe o motivo, em até {{ limite }} caracteres.</span>
        }
      </label>
      <ng-container uiDialogFooter>
        <button type="button" class="btn btn--tertiary btn--rect" (click)="visible.set(false)">
          Cancelar
        </button>
        <button type="button" class="btn btn--danger" [disabled]="enviando()" (click)="confirmar()">
          @if (enviando()) {
            <ui-spinner size="sm" />
          }
          {{ confirmLabel() }}
        </button>
      </ng-container>
    </ui-dialog>
  `,
})
export class MotivoDialogComponent {
  readonly visible = model(false);
  readonly heading = input.required<string>();
  readonly confirmLabel = input.required<string>();
  readonly ajuda = input('O motivo fica registrado na trilha.');
  readonly erro = input<string | null>(null);
  readonly enviando = input(false);
  readonly confirmado = output<string>();

  protected readonly limite = LIMITE_DO_MOTIVO;
  protected readonly tentou = signal(false);
  protected readonly motivo = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(LIMITE_DO_MOTIVO)],
  });

  constructor() {
    // O diálogo mantém o conteúdo entre aberturas: cada abertura começa sem o motivo da anterior.
    effect(() => {
      if (!this.visible()) return;
      untracked(() => {
        this.motivo.reset('');
        this.tentou.set(false);
      });
    });
  }

  protected confirmar(): void {
    this.tentou.set(true);
    const texto = this.motivo.value.trim();
    if (this.enviando()) return;
    if (texto === '') {
      this.motivo.setErrors({ required: true });
      return;
    }
    this.confirmado.emit(texto);
  }
}
