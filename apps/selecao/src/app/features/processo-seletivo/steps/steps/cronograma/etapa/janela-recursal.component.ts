import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ValorLegivelDirective } from '@uniplus/shared-ui/components';

import type { RecursoDaEtapa } from '../../../processo-seletivo.models';
import { CatalogosDoCronogramaService } from '../catalogos-do-cronograma.service';
import type { EtapaForm } from '../cronograma-form';
import { EdicaoDaEtapa } from '../servicos/edicao-da-etapa.service';
import { FormularioDoCronograma } from '../servicos/formulario-do-cronograma.service';

@Component({
  selector: 'div[selJanelaRecursal]',
  imports: [ValorLegivelDirective],
  templateUrl: './janela-recursal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JanelaRecursalComponent {
  readonly grupo = input.required<FormGroup<EtapaForm>>();
  readonly indiceDaEtapa = input.required<number>();
  readonly recursoDaEtapa = input.required<RecursoDaEtapa>();
  readonly indiceDoRecurso = input.required<number>();
  protected readonly catalogos = inject(CatalogosDoCronogramaService);
  protected readonly edicao = inject(EdicaoDaEtapa);
  protected readonly cronograma = inject(FormularioDoCronograma);
  protected readonly edicaoLiberada = this.cronograma.edicaoLiberada;
}
