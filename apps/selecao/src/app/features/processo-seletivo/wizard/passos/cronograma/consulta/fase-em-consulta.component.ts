import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ValorEmConsultaComponent } from '@uniplus/shared-ui/components';

import { fimDaFaseNaTela } from '../../fase/campo-da-fase';
import { FasePassoComponent } from '../../fase/fase.component';
import { EdicaoDaEtapa } from '../servicos/edicao-da-etapa.service';
import type { FaseNaLinhaDoTempo } from '../servicos/formulario-do-cronograma.service';
import { LeituraDaLinhaDoTempo } from '../servicos/leitura-da-linha-do-tempo.service';

/** A fase de um processo que só se lê: cada declaração em texto, sem campo nem ação de edição. */
@Component({
  selector: 'sel-fase-em-consulta',
  imports: [ValorEmConsultaComponent, FasePassoComponent],
  templateUrl: './fase-em-consulta.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class FaseEmConsultaComponent {
  readonly fase = input.required<FaseNaLinhaDoTempo>();
  protected readonly edicao = inject(EdicaoDaEtapa);
  protected readonly leitura = inject(LeituraDaLinhaDoTempo);

  /** O Fim se lê pela mesma regra da edição: aparece quando a fase o exige ou o processo já o guarda. */
  protected fimNaConsulta(): boolean {
    const item = this.fase();
    return fimDaFaseNaTela(item.exigencias, item.grupo.controls.fim.value !== '');
  }
}
