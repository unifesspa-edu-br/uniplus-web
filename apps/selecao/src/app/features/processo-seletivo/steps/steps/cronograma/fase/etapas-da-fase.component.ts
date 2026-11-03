import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { EditorDaEtapaComponent } from '../etapa/editor-da-etapa.component';
import { ExpansaoDoCronograma } from '../servicos/expansao-do-cronograma.service';
import type { FaseNaLinhaDoTempo } from '../servicos/formulario-do-cronograma.service';
import { LeituraDaLinhaDoTempo } from '../servicos/leitura-da-linha-do-tempo.service';

@Component({
  selector: 'div[selEtapasDaFase]',
  imports: [EditorDaEtapaComponent],
  templateUrl: './etapas-da-fase.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EtapasDaFaseComponent {
  readonly fase = input.required<FaseNaLinhaDoTempo>();
  protected readonly expansao = inject(ExpansaoDoCronograma);
  protected readonly leitura = inject(LeituraDaLinhaDoTempo);
}
