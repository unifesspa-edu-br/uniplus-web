import { ChangeDetectionStrategy, Component, ElementRef, computed, inject } from '@angular/core';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import {
  acompanharLeitura,
  FalhaDeLeituraComponent,
  IndicadorDaLeituraDirective,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';

import { mensagemDaFalha } from '../leitura';
import { formatarTotal } from './resultado-do-lote';
import { NotasDoEnemDoProcesso } from './notas-do-enem-do-processo.service';

/** As gerações do arquivo de envio da edição: cada uma é um ato registrado. */
@Component({
  selector: 'sel-historico-de-envios',
  standalone: true,
  imports: [DateBrPipe, FalhaDeLeituraComponent, IndicadorDaLeituraDirective, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './historico-de-envios.component.html',
  styleUrl: './compartilhado.css',
})
export class HistoricoDeEnviosComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly notas = inject(NotasDoEnemDoProcesso);
  protected readonly total = formatarTotal;
  protected readonly leitura = acompanharLeitura({
    falha: computed(() => mensagemDaFalha(this.notas.envios())),
    pendente: this.notas.relendoEnvios,
    recarregar: () => void this.notas.recarregarEnvios(),
    destino: () => this.host.nativeElement.querySelector('h3'),
  });
}
