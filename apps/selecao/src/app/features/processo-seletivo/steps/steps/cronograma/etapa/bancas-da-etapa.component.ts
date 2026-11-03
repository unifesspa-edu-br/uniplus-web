import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { FormGroup } from '@angular/forms';

import { CatalogosDoCronogramaService } from '../catalogos-do-cronograma.service';
import type { EtapaForm } from '../cronograma-form';
import { EdicaoDaEtapa } from '../servicos/edicao-da-etapa.service';
import { FormularioDoCronograma } from '../servicos/formulario-do-cronograma.service';

@Component({
  selector: 'div[selBancasDaEtapa]',
  templateUrl: './bancas-da-etapa.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BancasDaEtapaComponent {
  readonly grupo = input.required<FormGroup<EtapaForm>>();
  readonly indiceDaEtapa = input.required<number>();
  protected readonly catalogos = inject(CatalogosDoCronogramaService);
  protected readonly edicao = inject(EdicaoDaEtapa);
  protected readonly cronograma = inject(FormularioDoCronograma);
  protected readonly edicaoLiberada = this.cronograma.edicaoLiberada;
}
