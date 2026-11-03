import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { FormGroup } from '@angular/forms';

import type { EtapaForm } from '../cronograma-form';
import { EdicaoDaEtapa } from '../servicos/edicao-da-etapa.service';
import { ExpansaoDoCronograma } from '../servicos/expansao-do-cronograma.service';
import { FormularioDoCronograma } from '../servicos/formulario-do-cronograma.service';

@Component({
  selector: 'div[selCabecalhoDaEtapa]',
  templateUrl: './cabecalho-da-etapa.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CabecalhoDaEtapaComponent {
  readonly grupo = input.required<FormGroup<EtapaForm>>();
  readonly indiceDaEtapa = input.required<number>();
  protected readonly edicao = inject(EdicaoDaEtapa);
  protected readonly expansao = inject(ExpansaoDoCronograma);
  protected readonly cronograma = inject(FormularioDoCronograma);
  protected readonly edicaoLiberada = this.cronograma.edicaoLiberada;
  protected readonly etapas = this.cronograma.etapas;
}
