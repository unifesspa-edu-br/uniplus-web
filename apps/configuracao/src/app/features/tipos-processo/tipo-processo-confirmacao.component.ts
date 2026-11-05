import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { DialogComponent, SpinnerComponent } from '@uniplus/shared-ui/components';

@Component({
  selector: 'cfg-tipo-processo-confirmacao',
  imports: [DialogComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
  template: `
    <ui-dialog [(visible)]="aberto" [heading]="titulo()" [dismissible]="!ocupada()">
      <p>{{ mensagem() }}</p>
      <span class="sr-only" role="status">{{
        ocupada() ? rotulo() + ' em andamento.' : erro()
      }}</span>
      <ng-container uiDialogFooter>
        <button
          type="button"
          class="btn btn--tertiary"
          [disabled]="ocupada()"
          (click)="aberto.set(false)"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="btn btn--primary"
          [attr.aria-disabled]="ocupada()"
          [attr.aria-busy]="ocupada()"
          (click)="aoConfirmar($event)"
        >
          @if (ocupada()) {
            <ui-spinner size="sm" />
          }
          {{ rotulo() }}
        </button>
      </ng-container>
    </ui-dialog>
  `,
})
export class TipoProcessoConfirmacaoComponent {
  readonly aberto = model(false);
  readonly titulo = input.required<string>();
  readonly rotulo = input.required<string>();
  readonly mensagem = input.required<string>();
  readonly erro = input.required<string | null>();
  readonly ocupada = input.required<boolean>();
  readonly confirmar = output<void>();
  protected aoConfirmar(evento: Event): void {
    if (this.ocupada()) {
      evento.preventDefault();
      return;
    }
    this.confirmar.emit();
  }
}
