import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ValorEmConsultaComponent } from '@uniplus/shared-ui/components';

import { parametrosEmTexto } from './leitura-dos-parametros';
import type { LeituraDoRecurso, ParametrosDoRecurso } from './parametros-do-recurso';

/**
 * Os parâmetros do recurso de um processo que não admite edição: cada valor com o nome que a
 * leitura devolveu, ou o código quando ela não trouxe nome. Não lê opção nenhuma da API: o
 * processo publicado mostra o que foi gravado.
 */
@Component({
  selector: 'sel-parametros-do-recurso-em-consulta',
  imports: [ValorEmConsultaComponent],
  template: `
    @let lido = texto();
    <div class="form-grid">
      <ui-valor-em-consulta rotulo="Prazo de interposição" [valor]="lido.prazo" />
      <ui-valor-em-consulta
        rotulo="Admite instância superior"
        [valor]="lido.admiteInstanciaSuperior"
      />
      <ui-valor-em-consulta
        rotulo="Efeito suspensivo na 1ª instância"
        [valor]="lido.efeitoSuspensivo"
      />
      <ui-valor-em-consulta rotulo="Guarda da vaga em disputa" [valor]="lido.guardaDaVaga" />
      @if (lido.prazoDaSegundaInstancia !== null) {
        <ui-valor-em-consulta
          rotulo="Prazo para recorrer em 2ª instância"
          [valor]="lido.prazoDaSegundaInstancia"
        />
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class ParametrosDoRecursoEmConsultaComponent {
  readonly parametros = input.required<ParametrosDoRecurso>();
  readonly leitura = input.required<LeituraDoRecurso>();

  protected readonly texto = computed(() => parametrosEmTexto(this.parametros(), this.leitura()));
}
