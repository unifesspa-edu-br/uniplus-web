import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { varianteDaSituacaoDaInscricao } from '@uniplus/shared-inscricao/situacao-da-inscricao';
import { TagComponent, ValorApresentadoComponent } from '@uniplus/shared-ui/components';
import type { ValorExibido } from './valor-da-resposta';

/**
 * O valor de uma resposta de inscrição já lido pelo tipo (`valorExibido`): o endereço sai em linhas,
 * a situação em etiqueta e o resto pelo `ui-valor-apresentado`.
 */
@Component({
  selector: 'insc-resposta-exibida',
  standalone: true,
  imports: [TagComponent, ValorApresentadoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let valor = exibido();
    @if ('linhas' in valor) {
      @for (linha of valor.linhas; track $index) {
        <span class="resposta__linha">{{ linha }}</span>
      }
    } @else if ('situacao' in valor) {
      <ui-tag [variant]="varianteDaSituacaoDaInscricao(valor.situacao)">{{
        valor.situacao
      }}</ui-tag>
    } @else {
      <ui-valor-apresentado [valor]="valor.valor" />
    }
  `,
  styles: `
    .resposta__linha {
      display: block;
      overflow-wrap: anywhere;
    }
  `,
})
export class RespostaExibidaComponent {
  readonly exibido = input.required<ValorExibido>();

  protected readonly varianteDaSituacaoDaInscricao = varianteDaSituacaoDaInscricao;
}
