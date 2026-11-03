import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LeituraDaLinhaDoTempo } from './servicos/leitura-da-linha-do-tempo.service';
import { FormularioDoCronograma } from './servicos/formulario-do-cronograma.service';

@Component({
  selector: 'div[selEtapasOrfas]',
  imports: [],
  templateUrl: './etapas-orfas.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EtapasOrfasComponent {
  protected readonly leitura = inject(LeituraDaLinhaDoTempo);
  protected readonly cronograma = inject(FormularioDoCronograma);
  protected readonly edicaoLiberada = this.cronograma.edicaoLiberada;
  protected readonly etapas = this.cronograma.etapas;
}
