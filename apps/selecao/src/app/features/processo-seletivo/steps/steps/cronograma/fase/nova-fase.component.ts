import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ValorLegivelDirective } from '@uniplus/shared-ui/components';
import { ReactiveFormsModule } from '@angular/forms';
import { CatalogosDoCronogramaService } from '../catalogos-do-cronograma.service';
import { UnidadesDasFases } from '../servicos/unidades-das-fases.service';
import { FormularioDoCronograma } from '../servicos/formulario-do-cronograma.service';
import { FORMULARIO_DO_PAI } from '../formulario-do-pai';

@Component({
  selector: 'div[selNovaFase]',
  imports: [ValorLegivelDirective, ReactiveFormsModule],
  templateUrl: './nova-fase.component.html',
  viewProviders: [FORMULARIO_DO_PAI],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NovaFaseComponent {
  protected readonly catalogos = inject(CatalogosDoCronogramaService);
  protected readonly unidades = inject(UnidadesDasFases);
  protected readonly cronograma = inject(FormularioDoCronograma);
  protected readonly edicaoLiberada = this.cronograma.edicaoLiberada;
  protected readonly fases = this.cronograma.fases;
  protected readonly formulario = this.cronograma.formulario;
  protected readonly fasesDisponiveis = this.cronograma.fasesDisponiveis;
}
