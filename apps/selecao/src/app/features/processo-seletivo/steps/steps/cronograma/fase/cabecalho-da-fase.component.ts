import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ExpansaoDoCronograma } from '../servicos/expansao-do-cronograma.service';
import { LeituraDaLinhaDoTempo } from '../servicos/leitura-da-linha-do-tempo.service';
import {
  FormularioDoCronograma,
  type FaseNaLinhaDoTempo,
} from '../servicos/formulario-do-cronograma.service';

@Component({
  selector: 'div[selCabecalhoDaFase]',
  imports: [],
  templateUrl: './cabecalho-da-fase.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CabecalhoDaFaseComponent {
  readonly fase = input.required<FaseNaLinhaDoTempo>();
  protected readonly expansao = inject(ExpansaoDoCronograma);
  protected readonly leitura = inject(LeituraDaLinhaDoTempo);
  protected readonly cronograma = inject(FormularioDoCronograma);
  protected readonly edicaoLiberada = this.cronograma.edicaoLiberada;
  protected readonly linhaDoTempo = this.cronograma.linhaDoTempo;
}
