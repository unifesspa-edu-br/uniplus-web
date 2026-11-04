import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { ValorLegivelDirective } from '@uniplus/shared-ui/components';

import { pisoDeData, type EtapaForm } from '../cronograma-form';
import { FORMULARIO_DO_PAI } from '../formulario-do-pai';
import { EdicaoDaEtapa } from '../servicos/edicao-da-etapa.service';
import type { FaseNaLinhaDoTempo } from '../servicos/formulario-do-cronograma.service';

@Component({
  selector: 'sel-janela-da-etapa',
  imports: [ValorLegivelDirective, ReactiveFormsModule],
  templateUrl: './janela-da-etapa.component.html',
  viewProviders: [FORMULARIO_DO_PAI],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JanelaDaEtapaComponent {
  readonly grupo = input.required<FormGroup<EtapaForm>>();
  readonly indiceDaEtapa = input.required<number>();
  readonly fase = input.required<FaseNaLinhaDoTempo>();
  protected readonly edicao = inject(EdicaoDaEtapa);
  protected readonly pisoDeData = pisoDeData;
}
