import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { FormularioDoCronograma } from './servicos/formulario-do-cronograma.service';
import { LeituraDaLinhaDoTempo } from './servicos/leitura-da-linha-do-tempo.service';

@Component({
  selector: 'sel-etapas-orfas',
  templateUrl: './etapas-orfas.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class EtapasOrfasComponent {
  protected readonly leitura = inject(LeituraDaLinhaDoTempo);
  protected readonly cronograma = inject(FormularioDoCronograma);
  protected readonly edicaoLiberada = this.cronograma.edicaoLiberada;
  protected readonly etapas = this.cronograma.etapas;
}
