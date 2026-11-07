import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ValorLegivelDirective } from '@uniplus/shared-ui/components';

import { CatalogoDeUnidadesDoCadastro } from '../catalogos/catalogo-de-unidades-do-cadastro.service';
import { SituacaoDosCatalogosDoCronograma } from '../catalogos/situacao-dos-catalogos-do-cronograma.service';
import { FORMULARIO_DO_PAI } from '../formulario-do-pai';
import { FormularioDoCronograma } from '../servicos/formulario-do-cronograma.service';

@Component({
  selector: 'sel-nova-fase',
  imports: [ValorLegivelDirective, ReactiveFormsModule],
  templateUrl: './nova-fase.component.html',
  viewProviders: [FORMULARIO_DO_PAI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class NovaFaseComponent {
  protected readonly catalogoDeUnidades = inject(CatalogoDeUnidadesDoCadastro);
  protected readonly unidadesSemLista = inject(SituacaoDosCatalogosDoCronograma).leituraDasUnidades.visivel;
  protected readonly cronograma = inject(FormularioDoCronograma);
  protected readonly edicaoLiberada = this.cronograma.edicaoLiberada;
  protected readonly formulario = this.cronograma.formulario;
  protected readonly fasesDisponiveis = this.cronograma.fasesDisponiveis;
}
