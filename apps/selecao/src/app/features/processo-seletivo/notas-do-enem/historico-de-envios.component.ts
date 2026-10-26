import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { AlertComponent, SpinnerComponent } from '@uniplus/shared-ui/components';

import { formatarTotal } from './resultado-do-lote';
import { NotasDoEnemDoProcesso } from './notas-do-enem-do-processo.service';

/** As gerações do arquivo de envio da edição: cada uma é um ato registrado. */
@Component({
  selector: 'sel-historico-de-envios',
  standalone: true,
  imports: [AlertComponent, DateBrPipe, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './historico-de-envios.component.html',
  styleUrl: './compartilhado.css',
})
export class HistoricoDeEnviosComponent {
  protected readonly notas = inject(NotasDoEnemDoProcesso);
  protected readonly total = formatarTotal;
}
