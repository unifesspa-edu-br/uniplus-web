import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { FormGroup } from '@angular/forms';

import { CatalogosDoCronogramaService } from '../catalogos-do-cronograma.service';
import type { EtapaForm } from '../cronograma-form';
import { EdicaoDaEtapa } from '../servicos/edicao-da-etapa.service';
import { ExpansaoDoCronograma } from '../servicos/expansao-do-cronograma.service';
import { FormularioDoCronograma } from '../servicos/formulario-do-cronograma.service';

@Component({
  selector: 'sel-publicacoes-da-etapa',
  templateUrl: './publicacoes-da-etapa.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicacoesDaEtapaComponent {
  readonly grupo = input.required<FormGroup<EtapaForm>>();
  readonly indiceDaEtapa = input.required<number>();
  protected readonly catalogos = inject(CatalogosDoCronogramaService);
  protected readonly edicao = inject(EdicaoDaEtapa);
  protected readonly expansao = inject(ExpansaoDoCronograma);
  protected readonly cronograma = inject(FormularioDoCronograma);
  protected readonly edicaoLiberada = this.cronograma.edicaoLiberada;
}
