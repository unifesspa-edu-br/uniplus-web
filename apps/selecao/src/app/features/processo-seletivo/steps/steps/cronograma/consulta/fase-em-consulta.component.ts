import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ValorEmConsultaComponent } from '@uniplus/shared-ui/components';

import { FaseStepComponent } from '../../fase/fase.component';
import { EdicaoDaEtapa } from '../servicos/edicao-da-etapa.service';
import { type FaseNaLinhaDoTempo } from '../servicos/formulario-do-cronograma.service';
import { LeituraDaLinhaDoTempo } from '../servicos/leitura-da-linha-do-tempo.service';

/** A fase de um processo que só se lê: cada declaração em texto, sem campo nem ação de edição. */
@Component({
  selector: 'div[selFaseEmConsulta]',
  imports: [ValorEmConsultaComponent, FaseStepComponent],
  templateUrl: './fase-em-consulta.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FaseEmConsultaComponent {
  readonly fase = input.required<FaseNaLinhaDoTempo>();
  protected readonly edicao = inject(EdicaoDaEtapa);
  protected readonly leitura = inject(LeituraDaLinhaDoTempo);
}
