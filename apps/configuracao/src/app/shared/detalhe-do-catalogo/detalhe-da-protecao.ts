import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { type ProtecaoExibida } from '../protecao-do-catalogo';

/**
 * A proteção de dados de um item do catálogo, em leitura: classificação, hipótese legal e
 * finalidade do tratamento.
 */
@Component({
  selector: 'cfg-detalhe-da-protecao',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="cfg-detalhe-secao">
      <h3 class="cfg-detalhe-secao__titulo">{{ titulo() }}</h3>
      <dl class="cfg-detalhe">
        <div>
          <dt>Classificação</dt>
          <dd>{{ protecao().classificacaoProtecao.rotulo }}</dd>
        </div>
        <div>
          <dt>Hipótese legal</dt>
          <dd>{{ protecao().hipoteseLegal.rotulo }}</dd>
        </div>
        <div>
          <dt>Finalidade do tratamento</dt>
          <dd>{{ protecao().finalidadeTratamento || '—' }}</dd>
        </div>
      </dl>
    </section>
  `,
})
export class DetalheDaProtecaoComponent {
  readonly titulo = input('Proteção de dados');
  readonly protecao = input.required<ProtecaoExibida>();
}
