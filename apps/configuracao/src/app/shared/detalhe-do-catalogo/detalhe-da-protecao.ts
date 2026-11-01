import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  CLASSIFICACOES_DE_PROTECAO,
  HIPOTESES_LEGAIS,
  rotuloDe,
  type ProtecaoDoItem,
} from '../protecao-do-catalogo';

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
          <dd>{{ rotulo(classificacoes, protecao().classificacaoProtecao) }}</dd>
        </div>
        <div>
          <dt>Hipótese legal</dt>
          <dd>{{ rotulo(hipoteses, protecao().hipoteseLegal) }}</dd>
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
  readonly protecao = input.required<ProtecaoDoItem>();

  protected readonly classificacoes = CLASSIFICACOES_DE_PROTECAO;
  protected readonly hipoteses = HIPOTESES_LEGAIS;
  protected readonly rotulo = rotuloDe;
}
