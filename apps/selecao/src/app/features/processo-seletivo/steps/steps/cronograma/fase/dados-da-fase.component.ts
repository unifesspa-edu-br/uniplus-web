import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ValorLegivelDirective } from '@uniplus/shared-ui/components';
import { ReactiveFormsModule } from '@angular/forms';
import { CatalogosDoCronogramaService } from '../catalogos-do-cronograma.service';
import { UnidadesDasFases } from '../servicos/unidades-das-fases.service';
import { LeituraDaLinhaDoTempo } from '../servicos/leitura-da-linha-do-tempo.service';
import { pisoDeData } from '../cronograma-form';
import { type FaseNaLinhaDoTempo } from '../servicos/formulario-do-cronograma.service';
import { FORMULARIO_DO_PAI } from '../formulario-do-pai';

@Component({
  selector: 'div[selDadosDaFase]',
  imports: [ValorLegivelDirective, ReactiveFormsModule],
  templateUrl: './dados-da-fase.component.html',
  viewProviders: [FORMULARIO_DO_PAI],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DadosDaFaseComponent {
  readonly fase = input.required<FaseNaLinhaDoTempo>();
  protected readonly catalogos = inject(CatalogosDoCronogramaService);
  protected readonly unidades = inject(UnidadesDasFases);
  protected readonly leitura = inject(LeituraDaLinhaDoTempo);
  protected readonly pisoDeData = pisoDeData;
}
