import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  inject,
  input,
} from '@angular/core';

import { DadoDirective } from '../lista-de-dados/dado';

export type UiNivelDaSecao = 2 | 3 | 4 | 5;
export type UiLarguraDaSecao = 'automatica' | 'inteira';

/** Até tantos dados, sem seção dentro, a seção é curta e divide a linha com outras. */
const DADOS_DA_SECAO_CURTA = 4;

/**
 * Uma seção de um `ui-documento`: o título no nível pedido e o conteúdo, que pode ter outras seções.
 *
 * É a dona da regra da grade: em largura automática, a seção curta — até quatro dados e nenhuma
 * seção dentro, como a de um grupo — ocupa uma coluna da grade, e as demais, a linha inteira. Assim
 * nenhuma página conta pares para decidir o leiaute.
 *
 * A estrutura fica nos títulos, sem marco de região por seção: um documento com dezenas de seções
 * encheria de marcos a navegação do leitor de tela. A seção de fora tem superfície de cartão; a que está num cartão tem só contorno, e a que está
 * dentro desta, só um separador.
 */
@Component({
  selector: 'ui-secao-de-documento',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'secao-de-documento',
    '[class.secao-de-documento--inteira]': '!curta()',
    '[class.secao-de-documento--num-cartao]': 'profundidade === 1',
    '[class.secao-de-documento--interna]': 'profundidade > 1',
  },
  template: `
    @switch (nivel()) {
      @case (2) {
        <h2 class="secao-de-documento__titulo">{{ titulo() }}</h2>
      }
      @case (3) {
        <h3 class="secao-de-documento__titulo">{{ titulo() }}</h3>
      }
      @case (4) {
        <h4 class="secao-de-documento__titulo">{{ titulo() }}</h4>
      }
      @default {
        <h5 class="secao-de-documento__titulo">{{ titulo() }}</h5>
      }
    }
    <div class="secao-de-documento__corpo">
      <ng-content />
    </div>
  `,
})
export class SecaoDeDocumentoComponent {
  readonly titulo = input.required<string>();
  readonly nivel = input<UiNivelDaSecao>(2);
  readonly largura = input<UiLarguraDaSecao>('automatica');

  private readonly pai = inject(SecaoDeDocumentoComponent, { optional: true, skipSelf: true });
  /** Quantas seções há em volta desta: 0 é a de fora, a que tem superfície de cartão. */
  protected readonly profundidade: number = this.pai ? this.pai.profundidade + 1 : 0;

  private readonly dados = contentChildren(DadoDirective, { descendants: true });
  private readonly secoesDentro = contentChildren(SecaoDeDocumentoComponent, { descendants: true });

  readonly curta = computed(
    () =>
      this.largura() === 'automatica' &&
      this.secoesDentro().length === 0 &&
      this.dados().length <= DADOS_DA_SECAO_CURTA,
  );
}
