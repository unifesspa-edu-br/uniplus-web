import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ValorLegivelDirective } from '@uniplus/shared-ui/components';

import type { RecursoDaEtapa } from '../../../processo-seletivo.models';
import {
  UNIDADES_DA_INTERPOSICAO,
  UNIDADES_DA_SUSPENSIVIDADE,
} from '../../../shared/unidades-de-prazo-do-recurso';
import { CatalogoDeAtos } from '../catalogos/catalogo-de-atos.service';
import type { EtapaForm } from '../cronograma-form';
import { EdicaoDaEtapa } from '../servicos/edicao-da-etapa.service';
import { FormularioDoCronograma } from '../servicos/formulario-do-cronograma.service';

@Component({
  selector: 'sel-janela-recursal',
  imports: [ValorLegivelDirective],
  templateUrl: './janela-recursal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JanelaRecursalComponent {
  readonly grupo = input.required<FormGroup<EtapaForm>>();
  readonly indiceDaEtapa = input.required<number>();
  readonly recursoDaEtapa = input.required<RecursoDaEtapa>();
  readonly indiceDoRecurso = input.required<number>();
  protected readonly unidadesDaInterposicao = UNIDADES_DA_INTERPOSICAO;
  protected readonly unidadesDaSuspensividade = UNIDADES_DA_SUSPENSIVIDADE;
  protected readonly catalogoDeAtos = inject(CatalogoDeAtos);
  protected readonly edicao = inject(EdicaoDaEtapa);
  protected readonly cronograma = inject(FormularioDoCronograma);
  protected readonly edicaoLiberada = this.cronograma.edicaoLiberada;
}
