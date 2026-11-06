import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { DIAS_SEMANA } from './calendario-dias-uteis.util';
import type { CelulaCalendarioMensal, MesCalendarioMensal } from './calendario-mensal.util';
import { rotuloDoDia, rotuloDoDiaSemOcorrencia, textoDaPrevia } from './dia-nao-util-legivel';

/** A grade dos meses do calendário, com a prévia de cada dia que tem ocorrência. */
@Component({
  selector: 'cfg-calendario-mensal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calendario-mensal.component.html',
  styleUrl: './calendario-mensal.component.css',
})
export class CalendarioMensalComponent {
  readonly meses = input.required<readonly MesCalendarioMensal[]>();
  /** A data cuja prévia está à vista. */
  readonly previa = model.required<string | null>();
  readonly diaEscolhido = output<CelulaCalendarioMensal>();

  protected readonly diasSemana = DIAS_SEMANA;
  protected readonly rotuloDoDia = rotuloDoDia;
  protected readonly rotuloDoDiaSemOcorrencia = rotuloDoDiaSemOcorrencia;
  protected readonly textoDaPrevia = textoDaPrevia;

  /** O mouse sai do botão que segue com o foco do teclado: a prévia só some se o foco não está nele. */
  protected aoSairComMouse(evento: MouseEvent): void {
    if (document.activeElement !== evento.currentTarget) {
      this.previa.set(null);
    }
  }

  protected aoPerderOFoco(evento: FocusEvent): void {
    if (evento.target instanceof HTMLElement && !evento.target.matches(':hover')) {
      this.previa.set(null);
    }
  }
}
