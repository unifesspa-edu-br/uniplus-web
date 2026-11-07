import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ValorLegivelDirective } from '@uniplus/shared-ui/components';

import { SituacaoDosCatalogosDoCronograma } from '../catalogos/situacao-dos-catalogos-do-cronograma.service';
import { pisoDeData } from '../cronograma-form';
import { FORMULARIO_DO_PAI } from '../formulario-do-pai';
import type { FaseNaLinhaDoTempo } from '../servicos/formulario-do-cronograma.service';
import { LeituraDaLinhaDoTempo } from '../servicos/leitura-da-linha-do-tempo.service';
import { UnidadesResponsaveisDasFases } from '../servicos/unidades-responsaveis-das-fases.service';

@Component({
  selector: 'sel-dados-da-fase',
  imports: [ValorLegivelDirective, ReactiveFormsModule],
  templateUrl: './dados-da-fase.component.html',
  viewProviders: [FORMULARIO_DO_PAI],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DadosDaFaseComponent {
  readonly fase = input.required<FaseNaLinhaDoTempo>();
  private readonly situacao = inject(SituacaoDosCatalogosDoCronograma);
  protected readonly unidades = inject(UnidadesResponsaveisDasFases);
  protected readonly leitura = inject(LeituraDaLinhaDoTempo);
  protected readonly unidadesSemLista = this.situacao.leituraDasUnidades.visivel;
  protected readonly pisoDeData = pisoDeData;
}
