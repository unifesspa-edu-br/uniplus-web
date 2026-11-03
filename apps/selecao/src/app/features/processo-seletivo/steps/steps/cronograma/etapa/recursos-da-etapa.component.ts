import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { EdicaoDaEtapa } from '../servicos/edicao-da-etapa.service';
import { ExpansaoDoCronograma } from '../servicos/expansao-do-cronograma.service';
import { FormularioDoCronograma } from '../servicos/formulario-do-cronograma.service';
import { FormGroup } from '@angular/forms';
import { type EtapaForm } from '../cronograma-form';
import { JanelaRecursalComponent } from './janela-recursal.component';

@Component({
  selector: 'div[selRecursosDaEtapa]',
  imports: [JanelaRecursalComponent],
  templateUrl: './recursos-da-etapa.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecursosDaEtapaComponent {
  readonly grupo = input.required<FormGroup<EtapaForm>>();
  readonly indiceDaEtapa = input.required<number>();
  protected readonly edicao = inject(EdicaoDaEtapa);
  protected readonly expansao = inject(ExpansaoDoCronograma);
  protected readonly cronograma = inject(FormularioDoCronograma);
  protected readonly edicaoLiberada = this.cronograma.edicaoLiberada;
}
