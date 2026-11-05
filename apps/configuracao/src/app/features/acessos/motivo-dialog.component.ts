import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AlertComponent, DialogComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { mensagemDeErroDoControle } from '../../shared/formulario';

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
      <fieldset
        role="none"
        [disabled]="enviando()"
        style="border: 0; margin: 0; padding: 0; min-width: 0"
      >
        <label class="field" [class.is-error]="tentou() && motivo().invalid">
          <span class="field__label is-required">Motivo</span>
          <textarea
            aria-required="true"
            class="textarea"
            [formControl]="motivo()"
            [attr.maxlength]="limite"
            [attr.aria-invalid]="tentou() && motivo().invalid ? 'true' : null"
            [attr.aria-describedby]="'cfg-motivo-ajuda'"
          ></textarea>
          <span id="cfg-motivo-ajuda" class="field__hint">{{ ajuda() }}</span>
          @if (tentou() && motivo().invalid) {
            <span class="field__error">{{
              mensagem(motivo()) || 'Informe o motivo, em até ' + limite + ' caracteres.'
            }}</span>
          }
        </label>
      </fieldset>
      <p role="status" class="sr-only">{{ enviando() ? 'Enviando decisão…' : '' }}</p>
      <ng-container uiDialogFooter>
        <button
          type="button"
          class="btn btn--tertiary btn--rect"
          [disabled]="enviando()"
          (click)="visible.set(false)"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="btn btn--danger"
          [attr.aria-disabled]="enviando() ? 'true' : null"
          [attr.aria-busy]="enviando()"
          (click)="confirmar($event)"
        >
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
  readonly confirmado = output<void>();
  readonly motivo = input.required<FormControl<string>>();
  readonly tentou = input(false);

  protected readonly limite = LIMITE_DO_MOTIVO;
  protected readonly mensagem = mensagemDeErroDoControle;

  protected confirmar(evento: Event): void {
    if (this.enviando()) {
      evento.preventDefault();
      return;
    }
    this.confirmado.emit();
  }
}
