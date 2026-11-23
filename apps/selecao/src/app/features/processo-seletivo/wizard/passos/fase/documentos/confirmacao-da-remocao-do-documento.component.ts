import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { DialogComponent } from '@uniplus/shared-ui/components';

@Component({
  selector: 'sel-confirmacao-da-remocao-do-documento',
  imports: [DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-dialog
      heading="Remover documento"
      [(visible)]="visivel"
      [describedBy]="descricaoId()"
      (closed)="aoFechar()"
    >
      <p [id]="descricaoId()">{{ texto() }}</p>
      <div uiDialogFooter>
        <button type="button" class="btn btn--secondary" (click)="visivel.set(false)">
          Cancelar
        </button>
        <button type="button" class="btn btn--danger" (click)="confirmar()">Remover</button>
      </div>
    </ui-dialog>
  `,
})
export class ConfirmacaoDaRemocaoDoDocumentoComponent {
  readonly visivel = model(false);
  readonly texto = input.required<string>();
  readonly descricaoId = input.required<string>();
  readonly confirmada = output<void>();

  private remocaoConfirmada = false;

  confirmar(): void {
    this.remocaoConfirmada = true;
    this.visivel.set(false);
  }

  aoFechar(): void {
    if (!this.remocaoConfirmada) return;
    this.remocaoConfirmada = false;
    this.confirmada.emit();
  }
}
