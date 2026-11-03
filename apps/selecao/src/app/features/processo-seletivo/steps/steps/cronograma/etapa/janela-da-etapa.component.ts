import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ValorLegivelDirective } from '@uniplus/shared-ui/components';
import { ReactiveFormsModule } from '@angular/forms';
import { EdicaoDaEtapa } from '../servicos/edicao-da-etapa.service';
import { pisoDeData, type EtapaForm } from '../cronograma-form';
import { FormGroup } from '@angular/forms';
import { type FaseNaLinhaDoTempo } from '../servicos/formulario-do-cronograma.service';
import { FORMULARIO_DO_PAI } from '../formulario-do-pai';

@Component({
  selector: 'div[selJanelaDaEtapa]',
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
